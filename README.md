# Teleprompter

A multi-actor teleprompter that runs as a small web server. There is one shared
script; each actor logs in with a role and sees the full script with their own
lines highlighted. When it's your turn, tap **Done** (or press Space/Enter) and
everyone's screen advances to the next line.

## Run

```
npm install
npm start            # http://localhost:3000
PORT=8080 node server.js my-script.txt
```

Actors open `http://<server-ip>:3000` on their phones/tablets and pick a role.
A special **Director** login can skip, go back, jump to any line (tap it),
restart, or reload the script from disk.

## Script format (`script.txt`)

```
ROLE: spoken line
(stage direction)
[also a stage direction]
# comment
```

Stage directions are shown but never waited on. Roles are taken from the script.
