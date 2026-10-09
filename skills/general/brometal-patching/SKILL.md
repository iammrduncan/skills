---
name: brometal-patching
description: Consume BroMetal as a patched dependency and upstream the fixes. Use when BroMetal needs a version bump, when a BroMetal defect or missing capability blocks work and needs a local patch, when a patch should be sent upstream as a pull request, or when checking whether existing patches can be retired. Covers the postinstall patch runner, per-contribution patch modules, the fork-and-PR workflow, and patch retirement.
---

# BroMetal as a patched dependency

BroMetal is pre-1.0 and moves. When it blocks us, we patch locally to stay unblocked, send the fix
upstream, and delete the patch when it lands. We do not fork, and we do not sit on a private fix.

Use the target repository's dependency and contribution policy. A portable patch fixes a defect
or adds a capability useful to other renderers; a project-specific preference does not belong upstream.

## The rule that governs every command

**A patch is temporary and must say when it dies.** Every patch module names its upstream pull
request and the exact steps to retire it. A patch whose PR is unknown is a patch nobody can ever
safely delete, and six months later nobody knows whether it is still needed.

## Commands

| Command | Purpose | Writes | Reference |
| --- | --- | --- | --- |
| `update [version]` | Bump BroMetal, re-check every patch against the new source, retire what landed | yes | [update.md](reference/update.md) |
| `patch <name>` | Add a local patch for a defect or missing capability | yes | [patch.md](reference/patch.md) |
| `pr <patch>` | Fork, implement against source, open the upstream pull request, tag the patch with it | yes | [pr.md](reference/pr.md) |

Routing:

- **Explicit command** — load its reference and follow it.
- **"BroMetal is broken / missing X"** — `patch`, after confirming the defect still exists in the
  latest published version. We have been four releases behind while writing a patch for something
  already fixed.
- **"Can we upgrade BroMetal?"** — `update`.
- **"Send this upstream"** — `pr`.

The normal order is `patch` → `pr` → (later) `update` retires it. Do not skip `pr`: a local patch
with no upstream pull request becomes permanent by default.

## Layout

```
scripts/patch-brometal.mjs           the runner: version guard, install discovery, PATCHES registry
scripts/patch-brometal.test.mjs      tests for the mechanism itself
scripts/patch-brometal/
  <contribution-name>.mjs            one module per upstream pull request
```

`package.json` runs the runner on `postinstall`, so every install re-applies every patch.

**One module per upstream contribution, not per file touched.** Split by what you would send
upstream, because that is the unit that gets retired. A patch touching five files for one idea is
one module and one PR; when it merges you delete exactly one file.

## Reference

| File | What it is |
| --- | --- |
| [reference/patch.md](reference/patch.md) | Writing a patch module and the runner's guarantees |
| [reference/pr.md](reference/pr.md) | Fork, implement against source, and open the pull request |
| [reference/pr-template.md](reference/pr-template.md) | The pull request body format, section by section |
| [reference/update.md](reference/update.md) | Version bumps, PR status checks, and retirement |

Read the target repository's `AGENTS.md` and relevant dependency ADRs before changing anything.
Their actual paths and policies are the authority; this skill carries the procedure.
