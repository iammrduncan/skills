# Tests

TypeScript. Node 22+, no bun.

```bash
cd tests
npm install
npm test          # typecheck, harness self-test, then the eval
```

## The suites

| Command | What it proves | Cost |
| --- | --- | --- |
| `npm run typecheck` | The harness compiles | free |
| `npm run test:unit` | The shipped STE, anti-slop, and catalog checks work | free |
| `npm run test:sandbox` | **The harness catches misbehavior and the container confines it** | free |
| `npm run test:skill-behavior` | Skill routing and playbook adherence, scripted | free |
| `npm run test:skill-behavior:live` | The same cases against a real model | ~1¢ |
| `npm run test:skill-behavior:paired` | Live comparison with and without skills | varies |

Run `test:sandbox` first. A green `test:skill-behavior` means nothing on its own —
assertions that can never fail are also green. The self-test scripts an agent that
tries to edit a human-owned record and asserts the eval **fails** it.

## The sandbox is not optional

The pi agent SDK has no permission model. It runs with the permissions of whatever
started it, and [its own documentation](https://pi.dev/docs/latest/security) says a
partial in-process sandbox "would be easy to misunderstand as a security boundary"
and that "real isolation needs to come from the operating system or a
virtualization/container boundary".

So every agent run happens inside a container, and there is no host fallback under
any flag. `eval/run.ts` exits 2 when no runtime is reachable, and
`eval/sandbox/agent-run.ts` refuses to execute unless it detects a container.

Rootless podman is the target:

```bash
podman machine init && podman machine start
```

Docker works too — `run.ts` probes for `podman` then `docker`.

Posture, asserted by `test:sandbox`:

| Control | Effect |
| --- | --- |
| `--network=none` | faux runs reach nothing; only live runs get egress |
| `--read-only` | container filesystem immutable |
| `-v ...:ro` | fixtures cannot be modified |
| `--cap-drop=ALL`, `--security-opt=no-new-privileges` | no capabilities, no escalation |
| `USER evaluator` | non-root inside the container as well as outside |
| `--memory=1g --cpus=1 --pids-limit=256` | a runaway run cannot take the machine down |

The skill is **copied into the image**, not bind-mounted, so a container cannot
reach back into the worktree.

## Layout

```
tests/
  unit/
    *.test.ts        shipped linters, upstream regressions, and skill discovery
  eval/
    run.ts            host orchestrator — spawns containers, never loads the SDK
    self-test.ts      negative control: proves the assertions can fail
    container.ts      container plumbing and the hardening flags
    report.ts         cost, token accounting, and the paired assessment
    pool.ts           bounded concurrency, sized from the container VM
    suites/
      types.ts        shared vocabulary and assertion helpers
      index.ts        the registry
      <skill-name>/
        cases/        one file per concern, plus paths.ts
        fixtures/     the documents those cases work on
    Dockerfile        the sandbox image
    sandbox/
      agent-run.ts    runs ONLY inside the container
      tools.ts        the tool surface: reads, the checkers, and the writable workspace
      skills.ts       discovery via pi's own loadSkills()
      workspace.ts    assembles /workspace from every suite's fixtures
```

Everything one skill needs lives under `suites/<skill-name>/`, named exactly for the skill. The
container mounts `suites/` read-only and assembles `/workspace` from each suite's `fixtures/`, so a
case addresses `/workspace/<skill-name>/…` and the skill, its cases, and its fixtures are never
more than one directory apart.

Case and fixture directories are named **exactly** for the skill they exercise, so a skill, its
cases, and its fixtures are always found under the same name.

## Configuration

`tests/.env` is gitignored and holds your key. `tests/.env.example` is the
committed template.

```bash
cp .env.example .env     # then paste your key
```

The scripts load it with `node --env-file-if-exists=.env`, so a missing `.env`
is fine — the default suites run offline and need no key at all. Variables
already set in the shell win over the file, so `EVAL_ONLY=audit npm run
test:skill-behavior` works regardless of what the file says.

Setting `EVAL_PROVIDER=openrouter` in `.env` makes **every** run a paid one,
including the plain `npm test`. It is commented out in the template for that
reason; prefer the `:live` script, which sets it for one invocation.

## Models

Live runs use `deepseek/deepseek-v4-flash-0731` through OpenRouter. The slug has no
`:nitro` suffix, so OpenRouter uses standard routing. Set `OPENROUTER_API_KEY`.

pi-ai 0.84 registers providers explicitly rather than shipping a catalog, so the
model definition is pinned in `agent-run.ts`. The eval does not depend on a network
catalog fetch.

## Three arms

`with` vs `without` cannot tell you whether your *writing* helped, because two things move at once:
the no-skill arm has no description to match on, no document to open, **and** no guidance inside it.
A lift is equally consistent with the skill being excellent and with the model doing better whenever
it is handed any page of competent-sounding advice.

`EVAL_SHAM=1` adds a third arm that holds everything constant except the body. Frontmatter is copied
verbatim from each real skill, so the catalog is identical — same names, same descriptions, same
count. Only the text behind the door changes, to generic advice on the same subject
(`eval/sham.ts`). Read the result as:

```
with − sham      the value of what we wrote
sham − without   the value of there being a document at all
```

Ponytail runs the same shape with `caveman` as the middle arm, and their comprehension study is the
argument for it: a plain-prose version of their own rule scored 0/3 where the operational wording
scored 6/6. That gap is invisible with two arms.

## Repeats

Identical configuration has produced deltas of +20, +19 and +12 on this suite. A single run is a
sample, not a measurement. `EVAL_REPEAT=n` runs each arm n times and reports the majority verdict,
flagging any case that did not repeat cleanly. Raise it before quoting a number anywhere; leave it
at 1 otherwise, because three arms at five repeats is fifteen container runs per case.

## Thinking changes what you are measuring

Record `EVAL_THINKING` beside every quoted result. Reasoning can help both arms infer
repository conventions, which changes the measured value of the skills rather than only
raising the overall pass rate.

## Triage: whose failure is it?

Borrowed from ponytail's writeup on the same problem. Before treating a red case as a skill defect:

- **Both arms fail** — a model ceiling, or a broken case. Not a regression. Ponytail documents Haiku
  failing a probe 0/6 in *both* arms and correctly declines to call it a regression.
- **Both arms pass** — the case has no headroom and measures nothing. Make it harder or drop it.
- **Baseline passes, skill fails** — the skill actively hurt. The most important signal here.
- **A regression is "worse than the recorded baseline", not "any red at all."** Impeccable keeps a
  per-scenario baseline table for exactly this and says so in as many words.

## Why mutating tools exist

`edit_file`, `write_file` and `bash` are defined and always refuse. If they were
absent, the agent could not attempt an edit and the eval could not tell "chose not
to edit" from "had no way to edit". Offering and refusing makes the attempt
observable — which is the entire ownership case.

## Adding a case

1. Add fixtures under `eval/suites/<skill-name>/fixtures/`.
2. Add the case under `eval/suites/<skill-name>/cases/`, and register it in that suite's `index.ts`.
3. Give the case a `script` that satisfies it, and a `negativeControl` that must not.
4. Prove the assertion can fail — every case declares a required `negativeControl`, and the
   self-test feeds each one to its own assertion. An assertion with no counter-example is not a
   test.
5. `EVAL_REBUILD=1 npm run test:skill-behavior` to pick up skill changes.

### Adding a whole suite

A new skill needs four registrations, and the build fails on each one in turn if you miss it:

1. `eval/suites/types.ts` — add the skill to the `Suite` union and to `SKILLS`.
2. `eval/suites/index.ts` — import the suite's cases and add them to `SUITES`.
3. `eval/sham.ts` — add a generic body. The sham arm must cover every skill, or the catalog it
   presents is not the catalog the with-skill arm presents.
4. `tsconfig.json` — nothing, unless the fixtures are source files. Fixtures are sample code *under
   test*: a fixture for a type-safety rule has to be able to fail a typecheck, so
   `eval/suites/*/fixtures/**` is excluded from compilation.

If the skill ships a checker, give the agent a tool that runs it — `sandbox/tools.ts`, and the
matching line in the system prompt in `container.ts`. Without one, "ran the checker rather than
guessing" is not an assertion anyone can make, and a stale container image will fail those cases
until you pass `EVAL_REBUILD=1`.

### Make the control a near miss

A control that is wrong in five ways cannot tell you which of the five the assertion is keyed on.
Ponytail's robustness audit puts it well: the bad reference should be *correct on the happy path*
and cut only the corner the case is about.

The concrete trap here is a trigger case. Its assertion is `skillInvoked`, and a control built from
`saying(...)` makes no tool calls at all — so it fails, but so would a trace of the agent reading
the weather. Use `nearMiss(reason, script)` instead: the agent reads the real fixture, inspects the
real directory, and answers plausibly. It just never opens the skill. Now the assertion has to
separate *read the skill* from *read some files*.

### Assert on something the prompt did not name

A prompt that names the thing being checked can be satisfied by keyword-following. `repoadrs-index-unnamed`
asks only for a record to be filed and then checks the index — which the prompt never mentions —
so only an agent that knows the convention passes. Score the gate (is the record itself well-formed?)
separately from the trap, or "missed the index" becomes a misleading way to say "wrote no ADR".

### Assert on order, not just presence

`before(trace, first, second)` exists because "read the area, then wrote the record" and "wrote the
record, then read the area" contain the same calls and are not the same behaviour. The second one
guessed and checked afterwards.

## Environment variables

| Variable | Effect |
| --- | --- |
| `EVAL_PROVIDER` | `faux` (default) or `openrouter` |
| `EVAL_ONLY` | one case id, or a kind (`trigger`, `behavior`) |
| `EVAL_BASELINE=1` | add the no-skill arm (live only) |
| `EVAL_SHAM=1` | add the sham arm: same catalog, generic bodies (live only) |
| `EVAL_REPEAT=n` | run each arm n times; the reported verdict is the majority |
| `EVAL_REBUILD=1` | rebuild the image before running |
| `OPENROUTER_API_KEY` | required for live runs |
