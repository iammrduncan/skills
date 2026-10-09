# Problem

`project dev` exits 0 when the game module throws during the first frame.

CI treats that as a pass, so a demo that crashes on load ships green. We want a non-zero exit when
the first frame does not complete, without changing behaviour for a game that starts fine and
crashes later — that case is already reported through the session fault path and we do not want to
double-report it.

The only open question is what exit code to use.
