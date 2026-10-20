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
restart, or reload the script from disk. The Director's device also plays the
background music (see below).

## Script format (`script.txt`)

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

Browsers only allow audio after a tap, so the Director taps **♪ Tap to enable** (the
login tap usually does it; after a page reload any tap does). The bar also has
mute and a volume slider. Tracks loop, so use files that loop cleanly (`.ogg` or a
trimmed `.mp3` avoids a gap at the seam).
