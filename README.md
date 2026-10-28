# Teleprompter

A multi-actor teleprompter that runs as a small web server. There is one shared
script; each actor logs in with a role and sees the full script with their own
lines highlighted. When it's your turn, tap **Done** (or press Space/Enter) and
everyone's screen advances to the next line.

## Run

```
npm install
npm start            # http://localhost:3000
PORT=8080 node server.js my-scripts-folder     # another folder of scripts
node server.js my-script.txt                   # or just one script file
```

Actors open `http://<server-ip>:3000` on their phones/tablets and pick a role.
A special **Director** login can skip, go back, jump to any line (tap it),
restart, switch scripts, or reload the scripts from disk. The Director's device
also plays the background music (see below).

## Multiple scripts

Every `.txt` file in `scripts/` is a script (`act-1.txt` shows as "act 1", sorted
naturally so act 2 comes before act 10). A short number prefix sets the order and is
not shown: `01-kitchen.txt` appears as "kitchen". The first script in that order is
live when the server starts.
When there is more than one, the Director sees a script picker; choosing one switches
**everyone** to it, restarting from its first line, with roles and music following the
new script. Actors whose role has no lines in it see "No lines for you in this script"
and can use **Switch role**.

Add, rename or edit script files while the server runs, then press **Reload script**
(it re-reads the folder and the active script and restarts). A script that fails to
load is reported to the Director and the show carries on with the current one.

Sample scripts that come with the repo:

| Script | What it is |
| --- | --- |
| `01-kitchen.txt` | The original two-person scene (ANNA, BOB, NARRATOR), with music cues |
| `02-lighthouse.txt` | A second cast (MARA, TOM), to try switching scripts |
| `03-music-demo.txt` | Walks through all four sample tracks, crossfades and a stop |
| `04-feature-test.txt` | Parser and cue edge cases; each line says what you should see |

## Script format (any `.txt` in `scripts/`)

```
ROLE: spoken line
(stage direction)
[also a stage direction]
# comment
```

Stage directions are shown but never waited on. Roles are taken from the script.

## Background music

The device logged in as **Director** plays looping background music, driven by the
stage directions. Put audio files (`.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`) in
`public/music/`; the file name is the track name (`soft-piano.mp3` is "soft piano").
Then write a stage direction that mentions music and names a track:

```
[Music: tense]
(Calm music fades in.)
[A door creaks. Music: soft piano, fading in slowly.]
[Music: stop]
[Music fades out. Lights down.]
```

- A direction is a music cue if it contains the word "music". Only the sentence that
  mentions music is read, so the rest of the direction can say anything.
- It names a track (the longest matching track name wins) or stops the music with a
  word like *stop*, *ends*, *silence* or *fade out*. Use one music action per direction.
- Words like *fade*, *fading* or *slowly* give a 4 s fade instead of the default 1.5 s;
  changing tracks crossfades.
- The music always follows the current line: it is whatever the last cue *before* it
  asked for, so Back, tapping a line to jump, and Restart all land on the right track.
- A cue with no matching file is ignored and shown as "no file for …" in the
  Director's music bar. Add or rename files, then press **Reload script**.

Four sample tracks are included in `public/music/`: `calm`, `tense`, `sad` and `hopeful`.
They are original ambient loops synthesized for this project (24 s, mono, WAV) and
free to use, replace or delete. Tracks loop, so use audio that loops cleanly: WAV
and `.ogg` loop without a gap, while `.mp3` and `.m4a` usually add a short silence at
the loop point.

Browsers only allow audio after a tap, so the Director taps **♪ Tap to enable** (the
login tap usually does it; after a page reload any tap does). The bar also has
mute and a volume slider.
