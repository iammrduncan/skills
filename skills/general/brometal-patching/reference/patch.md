# patch

Add a local patch so a BroMetal defect stops blocking work today.

A patch is a bridge to an upstream fix, not a substitute for one. Open the pull request in the same
piece of work — see [pr.md](pr.md).

## Before writing anything

1. **Confirm the defect exists in the latest published version.** Check the current release, not the
   one installed. We have written a patch while four releases behind, for something already fixed.
   `npm view brometal version`, then read the current source.
2. **Reproduce it, and write the failing test first.** Watch it fail against unpatched BroMetal.
   A patch with no failing test to justify it is a guess.
3. **Read the code you are about to change, including its comments.** Treat every comment as
   Chesterton's fence. In our render-target patch the comment blamed `rgba32float` — which is not
   filterable without a device feature — but `TARGET_FORMAT` is `rgba16float`, which *is* filterable
   in core WebGPU, and no `rgba32float` target is ever created. Half the comment was stale; the
   other half was real and had to be preserved. Say which half survives, in the patch's own comment.
4. **Check it is upstreamable.** The upstream contribution should help renderers in general or
   correct an error. If the change is a project-specific preference, it does not belong upstream, and
   therefore does not belong in a patch either — solve it on our side of the render driver.

## Write the module

One file per upstream contribution, at `scripts/patch-brometal/<contribution-name>.mjs`.

```js
/**
 * <short title — the capability or defect, in one line>
 *
 * <Why the patch exists. What the original code does, what is wrong with it, and — when a comment
 * explains the current behaviour — which part of that comment still holds and which is stale.>
 *
 * **Upstream: https://github.com/ericdrowell/brometal/pull/NN**
 * <the pull request title>
 *
 * Retire this file when #NN is merged or released. Nothing else needs changing —
 * remove the module, drop it from PATCHES in ../patch-brometal.mjs, and from the
 * scripts/ allowlist in ../repository-policy.test.mjs.
 */
export const name = '<contribution-name>';

export async function apply({ replace, replaceSection }) {
  await replace(
    'dist/runtime/webgpu.js',
    '<exact text before>',
    '<exact text after>',
  );
}
```

Then register it in `PATCHES` in `scripts/patch-brometal.mjs`, and add the file to the `scripts/`
allowlist in `scripts/repository-policy.test.mjs`, in the same commit.

The header is not decoration. It is the only thing that lets a future reader decide whether the
patch is still needed. Leave the upstream line as `**Upstream: (not yet opened)**` only if you are
opening the PR in the same session — [pr.md](pr.md) fills it in.

## What the runner guarantees, and why

Four properties. Each exists because its absence caused a real failure.

1. **Every installed copy is patched.** npm places a workspace dependency wherever hoisting allows,
   and that changes with the dependency graph. Ours moved from hoisted to nested-in-eight-workspaces
   during a version bump. A runner that patches the first copy it finds **fails silently** — the app
   runs an unpatched dependency and nothing says so. `findInstalls()` walks them all.
2. **The version is guarded.** `EXPECTED_VERSION` is exact. A patch applied to a version nobody has
   checked is worse than no patch, because it looks applied.
3. **A moved target throws.** If the "before" text is absent, the patch throws
   `patch target changed`. It must never silently no-op.
4. **It is idempotent.** `postinstall` runs on every install, so a patch that has already applied
   returns early:

   ```js
   const replace = async (relativePath, before, after) => {
     const source = await readFile(file, 'utf8');
     if (source.includes(after)) return;                       // idempotent
     if (!source.includes(before)) throw new Error(`patch target changed: ${relativePath}`);
     await writeFile(file, source.replace(before, after));
   };
   ```

Keep changes inside the existing runner structure. Add a module; do not restructure the runner
because your patch is shaped differently.

## Required tests

In `scripts/patch-brometal.test.mjs`, at minimum:

- running the patch twice changes **no bytes** — checksum before and after the second run;
- **and** the patched content is actually present. See the trap below;
- every installed copy is patched, not just the first;
- a wrong version throws, exercised against a fixture package rather than by editing the installed
  one;
- a moved target throws, exercised against a fixture;
- every module on disk is registered in `PATCHES`. A modular split makes it possible to write a
  patch nobody imported, which then never applies.

**The trap.** A before/after checksum cannot distinguish *unchanged because correct* from
*unchanged because it crashed before writing*. Ours reported idempotent while both runs were failing
on a syntax error. Always assert the patched content is present as well as that the second run is a
no-op.

## Verify

```bash
rm -rf node_modules && npm install     # clean install applies the patch
npm run postinstall                     # second run changes nothing
npm test
```

A change to the render path that has not been captured and looked at is not done. Re-capture the
demos and commit the metrics sidecars.

## Report

- the module path and what it changes;
- the failing test, and that you watched it fail before the patch;
- which half of any existing comment you preserved, and which was stale;
- the upstream pull request, or that `pr` is the next step;
- anything that needed the version guard bumped.
