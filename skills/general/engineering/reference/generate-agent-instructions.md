# generate-agent-instructions

Writes repository instruction files only on an explicit request to create or update them. A bare
target or audit request does not authorize generation. Preserve the requested destination and scope.

When the request involves choosing or combining style guides, load
[style-sources.md](style-sources.md) to compare sources and walk the owner through adaptations.

## Procedure

1. Discover applicable parent and nested instructions, existing conventions and delegates, owner
   decisions, stable rule IDs, and generated blocks. Read the files before editing them. Inspect
   representative architecture, code, tests, manifests, scripts, configuration, and CI. Follow
   chosen style sources when available. Missing sources remain gaps; do not invent their contents.
2. Build an evidence map: proposed rule, governing scope, source path or owner instruction, rationale,
   and verification mechanism. Separate configured enforcement, review discipline, and proposals.
   Trace CI commands through their scripts, working directories, coverage, and exceptions before
   claiming enforcement. Do not claim a check passed unless it ran successfully.
3. Adapt style deliberately. Start with the owner's selected sources and conventions. Explain why
   each material adaptation fits actual project constraints, and note rejected or deferred mandates.
   General principles such as narrow interfaces, bounded work, invariants, and negative-case testing
   can help many projects; Zig syntax, static allocation, fixed file/function caps, assertion quotas,
   and fxclaw's sans-io boundary are not universal defaults. Do not replace the owner's framework,
   glossary names, shortcut marker, or architecture to satisfy a borrowed style.
4. Resolve factual staleness within the authorized instruction scope. Preserve policy choices and
   nested exceptions. When guidance conflicts and the authority does not resolve it, report the
   conflict and leave that policy intact for an owner decision. Continue independent corrections.
   Generation is not permission to change thresholds, CI, source code, tests, or dependencies.
5. Write the smallest useful instruction set:
   - A concise `AGENTS.md` entry point with essential boundaries, verified working commands and
     their working directories, and links to detailed guidance when needed.
   - Detailed conventions only when the project benefits from them. Retain the established file
     name and stable IDs. Separate enforced gates from review rules and explain the important whys.
   - A delegating `CLAUDE.md` when requested or useful for the target. Use `@AGENTS.md` rather than
     duplicating policy; preserve existing unique owner instructions. For a nested delegate, resolve
     the correct relative file rather than importing a root file that loses the nested scope.
   Do not require all three files for a small project or rename established equivalents. Do not add
   dead links, unsupported claims, or placeholders presented as facts.
6. Re-read destinations immediately before writing. Preserve unrelated concurrent edits, owner text,
   and generated blocks; use focused edits. Repeated generation from unchanged evidence should leave
   already-correct files unchanged. Do not renumber rules or reformat for cosmetic consistency.

## Verification and report

Resolve all emitted local paths and imports from their containing files. Cross-check each command,
working directory, architecture statement, and enforcement claim against the evidence map. Run
appropriate non-destructive checks when available, respecting the user's execution constraints;
never run an update-goldens command merely to verify its spelling. Distinguish configured, run,
passed, and not run. Review the diff for lost scopes, exceptions, owner choices, generated blocks,
and unrelated changes. Compare the final files with the evidence map and confirm that unchanged
inputs do not call for further edits.

Report changed paths, evidence and adaptation rationale, checks performed and their limits, and any
remaining owner decisions. Missing evidence warrants a precise gap, not an authoritative rule.
