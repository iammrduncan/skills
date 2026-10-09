# Proposal: cache the parsed manifest

`project dev` reads and parses `<name>.project` on every file-change rebuild. The parse is 40ms and
runs 200+ times in a session.

Proposal: keep the parsed manifest in memory, keyed by the file's mtime and size. Re-parse when
either changes. Roughly 15 lines in the existing `project-services` module, no new dependency, no
new file.

Invalidation is the whole risk, and mtime+size is the same check the watcher already uses to decide
whether to rebuild, so a stale cache would mean the watcher was already broken.
