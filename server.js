// Teleprompter server: one script, many roles.
// Usage: node server.js [script.txt]     (PORT env var, default 3000)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const SCRIPT_FILE = path.resolve(process.argv[2] || path.join(__dirname, 'script.txt'));
const PUBLIC_DIR = path.join(__dirname, 'public');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'music'); // background tracks played on the Director's device
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac']);
const DIRECTOR = 'Director'; // special login: can advance/undo any line

// ---------- Script parsing ----------
// "ROLE: text"  -> spoken line
// "(...)" / "[...]" -> stage direction (shown, never waited on)
// "#..." and blank lines -> ignored
function parseScript(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith('#')) continue;
    if (/^[(\[].*[)\]]$/.test(s)) {
      lines.push({ type: 'direction', text: s.slice(1, -1).trim() });
      continue;
    }
    const m = s.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) lines.push({ type: 'line', role: m[1].trim().toUpperCase(), text: m[2].trim() });
    else lines.push({ type: 'direction', text: s });
  }
  return lines;
}

// ---------- Background music tracks ----------
// public/music/soft-piano.mp3 -> { name: 'soft piano', file: 'soft-piano.mp3' }
// The Director's client matches stage directions that mention music against these names.
function listTracks() {
  let names;
  try { names = fs.readdirSync(MUSIC_DIR); } catch { return []; } // no music folder = no tracks
  return names
    .filter(f => AUDIO_EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .map(f => ({
      name: path.basename(f, path.extname(f)).replace(/[-_]+/g, ' ').trim().toLowerCase(),
      file: f,
    }));
}

let script = [];
let roles = [];
let tracks = [];
function loadScript() {
  script = parseScript(fs.readFileSync(SCRIPT_FILE, 'utf8'));
  roles = [...new Set(script.filter(l => l.type === 'line').map(l => l.role))];
  tracks = listTracks();
}
loadScript();

// ---------- Shared state ----------
let current = 0; // index into script of the line being waited on

function skipDirections(i) {
  while (i < script.length && script[i].type === 'direction') i++;
  return i; // script.length means "finished"
}
current = skipDirections(0);

function online() {
  const set = new Set();
  for (const c of wss.clients) if (c.role && c.readyState === 1) set.add(c.role);
  return [...set];
}

function stateMsg() {
  return JSON.stringify({ type: 'state', current, total: script.length, online: online() });
}
function scriptMsg() {
  return JSON.stringify({ type: 'script', roles, lines: script, director: DIRECTOR, tracks });
}
function broadcast(msg) {
  for (const c of wss.clients) if (c.readyState === 1 && c.role) c.send(msg);
}

// ---------- HTTP (static files) ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
};
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } // track names may contain spaces
  catch { res.writeHead(400); return res.end(); }
  const rel = url === '/' ? '/index.html' : url;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const headers = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes', // iOS Safari refuses to play audio from servers without byte ranges
    };
    let start = 0, end = st.size - 1, status = 200;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2]) && st.size > 0) {
      if (range[1] === '') start = Math.max(0, st.size - Number(range[2])); // "-N" = last N bytes
      else {
        start = Number(range[1]);
        if (range[2] !== '') end = Math.min(end, Number(range[2]));
      }
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['Content-Length'] = st.size === 0 ? 0 : end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  ws.role = null;
  // Anyone can see the role list before logging in.
  ws.send(JSON.stringify({ type: 'roles', roles, director: DIRECTOR }));

  ws.on('message', buf => {
    let m;
    try { m = JSON.parse(buf); } catch { return; }

    if (m.type === 'login') {
      const role = String(m.role || '').toUpperCase();
      const isDirector = role === DIRECTOR.toUpperCase();
      if (!isDirector && !roles.includes(role)) return ws.send(JSON.stringify({ type: 'error', message: 'Unknown role' }));
      ws.role = isDirector ? DIRECTOR : role;
      ws.send(JSON.stringify({ type: 'welcome', role: ws.role }));
      ws.send(scriptMsg());
      ws.send(stateMsg());
      return broadcast(stateMsg());
    }

    if (!ws.role) return;
    const isDirector = ws.role === DIRECTOR;
    const line = script[current];

    if (m.type === 'done') {
      // An actor may only finish their own line; the director may finish any.
      if (!line || line.type !== 'line') return;
      if (!isDirector && line.role !== ws.role) return;
      current = skipDirections(current + 1);
      broadcast(stateMsg());
    } else if (isDirector && m.type === 'back') {
      let i = current - 1;
      while (i > 0 && script[i].type === 'direction') i--;
      current = Math.max(0, i);
      current = skipDirections(current);
      broadcast(stateMsg());
    } else if (isDirector && m.type === 'jump') {
      const i = Number(m.index);
      if (Number.isInteger(i) && i >= 0 && i < script.length) {
        current = skipDirections(i);
        broadcast(stateMsg());
      }
    } else if (isDirector && m.type === 'reset') {
      current = skipDirections(0);
      broadcast(stateMsg());
    } else if (isDirector && m.type === 'reload') {
      try {
        loadScript();
        current = skipDirections(0);
        broadcast(scriptMsg());
        broadcast(stateMsg());
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Reload failed: ' + e.message }));
      }
    }
  });

  ws.on('close', () => broadcast(stateMsg()));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Teleprompter running on http://localhost:${PORT}`);
  console.log(`Script: ${SCRIPT_FILE}`);
  console.log(`Roles: ${roles.join(', ')}  (plus ${DIRECTOR})`);
});
