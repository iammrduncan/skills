# pr

Send one local patch upstream, and tag the patch with the pull request.

One patch, one branch, one pull request. The PR body format is in
[pr-template.md](pr-template.md).

## Procedure

### 1. Work in the fork, against source — never against `dist/`

The published package ships compiled output. Patching `dist/` is right locally and wrong upstream: a
maintainer wants the change in the TypeScript.

```bash
gh repo clone <you>/brometal fork      # the fork already has `upstream` configured
cd fork
git fetch upstream && git checkout -b <one-branch-per-patch> upstream/main
```

Find the real source for what you patched. This routinely surfaces things the compiled output hides
— in one of ours, an entire emitter had been removed since the branch we were reading was written.

Branch from current `upstream/main`, not from whatever the fork last had.

### 2. Read the project's own rules first

`AGENTS.md`, `CONTRIBUTING.md`, the test commands. Match their conventions: their test framework,
their comment voice, their fixture layout, their naming. A pull request that looks like it belongs
is easier to accept.

### 3. Keep it to one idea, and make it independent

Five separate pull requests beat one 8,000-line pull request. Say in the body that it stands alone
and can land on its own.

Watch for accidental coupling. Two of ours nearly added the same test fixture, which would have made
them conflict on a file neither needed to share — reuse an existing fixture instead.

If two changes genuinely cannot be separated, put them in one pull request, say why, and **offer to
split it**.

### 4. Prove it in their harness

Add a test in the project's own style. If they have a GPU or integration suite that reads real
output, put it there rather than in unit tests — that is usually where the assertions that matter
live.

**Record the before and after.** This is the strongest thing a pull request can carry:

```
WITHOUT   ✗ two batches in one frame keep their own attribute data
WITH      ✓ two batches in one frame keep their own attribute data
```

Revert the fix, rebuild, run, capture the failure, restore. That converts "this fixes a bug" into
evidence.

Run their typecheck, their unit suite, and their integration suite. Say plainly what you could not
run — one of ours could not run WebKit locally, and saying so was better than letting the maintainer
wonder.

### 5. Open the pull request

Use [pr-template.md](pr-template.md). Every section earns its place, and the closing section is not
optional: it hands the maintainer control, which is the honest framing when you are a stranger to
their codebase.

```bash
gh pr create --repo ericdrowell/brometal --head <you>:<branch> \
  --title "<area>: <what changes, in their voice>" --body-file <path>
```

### 6. Tag the local patch with the pull request

Back in the consuming repository, put the URL and the title in the patch module's header:

```js
 * **Upstream: https://github.com/ericdrowell/brometal/pull/NN**
 * <the pull request title>
 *
 * Retire this file when #NN is merged or released. Nothing else needs changing —
 * remove the module, drop it from PATCHES in ../patch-brometal.mjs, and from the
 * scripts/ allowlist in ../repository-policy.test.mjs.
```

**This step is the point of the command.** A patch without its pull request URL cannot be retired by
anyone who was not there, and `update` has nothing to check.

### 7. Report

- the pull request URL and title;
- the BroMetal source file it changes, against the local `dist/` patch it corresponds to;
- the test added, and the before/after evidence;
- what you could not run;
- that the local module header now carries the URL.

## Do not

- Do not bundle two patches into one pull request without saying why and offering to split.
- Do not send a project-specific preference upstream. A contribution must help renderers in general
  or correct an error.
- Do not open a pull request against `dist/`.
- Do not delete the local patch when the pull request opens. It is retired when the change is merged
  or released — that is `update`'s job.
- Do not argue in the thread. If the maintainer prefers a different approach, write their version.
