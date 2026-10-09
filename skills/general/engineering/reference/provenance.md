# Provenance and maintenance

## Principles

`GOOD_ENGINEERING_H.md` is the human-owned principles source shipped with this skill. The owner
removed the duplicate authoring copy during the 2026-10-08 cleanup. Repository agent instructions
now point to this bundled file. Preserve owner decisions when updating it. The owner's notes
authorized the resource and state-transition additions before that cleanup.

## Instruction workflow evidence

Inspected local fxclaw files on 2026-10-08 at checkout HEAD
`2acfd1f472f42e5b3ba6b13db1c0fc0feca5b0cf`: `AGENTS.md`, `CONVENTIONS.md`, `CLAUDE.md`,
`docs/_internal/style/ladder.md`, and `docs/_internal/style/tigerstyle.md`. These files had no local
modifications in the inspection. This identifies local evidence, not a claim about current upstream.
The retained source record is `docs/SOURCES.md` in the authoring repository; installed use does
not depend on that file or the fxclaw checkout.

Borrowed structure and ideas: a short entry point, detailed conventions separating gates from review
judgement, stable IDs, a delegating Claude file, and rationale for architecture-specific adaptations.
The new playbooks are original procedures, not copies of fxclaw or TigerStyle prose. No direct
TigerStyle text was imported. Existing ladder and questioning copyright notices remain intact;
their original adaptation revisions are not established by this inspection.

Observed limitations: fxclaw's conventions link to a missing `docs/_internal/style/good-engineering.md`;
its local ladder uses `ceiling:` while this skill's existing adaptation uses `ponytail:`. Neither
spelling becomes a universal requirement. Its allocator exception demonstrates why style mandates
need architecture-specific reasoning. CI labels in that source were not independently validated here
and must not be copied as verified enforcement into a target project.

Intentional differences: instruction auditing stays read-only; generation requires an explicit
writing request, preserves nested scopes and owner choices, and derives claims from the target's
actual evidence. `plan-it` now excludes development-time estimates to agree with the bundled
principles. No source-specific paths, Zig caps, allocation bans, or assertion quotas become defaults.
