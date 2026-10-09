# Changelog

All notable changes to this repository are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). A skill's behaviour is its public
interface: a change that alters what an agent does when it loads a skill is a minor or major
version, not a patch.

## [Unreleased]

## [0.8.0] - 2026-10-08

Validation: deterministic checks only. Live paired evaluation was waived by the owner after
the configured provider rejected its credential. No model-behavior improvement is claimed.

### Added

- Style-source selection workflow, resource and invariant principles, and contextual manual code review from the owner notes.

- Engineering instruction audit and explicit generation commands, with evidence-based conventions and Claude delegation.
- Behavior cases for creation, nested scope, preservation, repeat stability, and routing before writes.
- Durable upstream source revisions and intentional adaptation records.
- Prose publication-residue and advisory paragraph/sentence checks adapted from local model work, plus explicit owner policy support.
- Exact-location TypeScript-rule regressions and selected upstream correctness fixes.

### Changed

- Moved repository ownership and current branding to `iammrduncan/skills`.
- Incorporated the remote cross-platform lint entrypoint and sandbox-probe fixes.
- Removed project-specific company assumptions from portable dependency and STE guidance.
- Context lookup also recognizes existing glossary files without renaming them.

### Fixed

- Added `show-me` to the README skill catalog.

## [0.7.0] — 2026-08-16

This release adds a visual-explanation skill that chooses the smallest useful representation for
the current topic instead of defaulting to prose or one heavyweight diagram format.

### Added

- **`show-me`**, with call-tree, pseudocode, component-tree, file-tree, Mermaid, diff, code-block,
  and focused responsive HTML guidance.
- OpenAI agent metadata with a complete `$show-me` default prompt and concise catalog description.
- Five behavior evals covering implicit invocation, call-tree selection, focused diffs, Mermaid
  interaction flow, and responsive HTML comparison artifacts.
- A targeted negative control for every `show-me` eval and a generic sham body for paired
  attribution.
- An Antiky Labs-branded README header with website and Discord links.

## [0.6.0] — 2026-08-16

The registry is smaller and the names are direct. The repository-specific wrappers did not change
the model's behavior in the paired ablation, so they are gone instead of remaining as another layer
an agent has to discover.

### Changed

- **All eight portable skills now live under `skills/general/` and no longer carry the `general-`
  prefix.** For example, `general-write-adrs` is now `write-adrs`. Frontmatter, agent prompts,
  cross-skill routing, documentation, and eval suite names moved with them.
- The eval catalog discovers nested skill categories while still presenting each leaf skill by its
  unprefixed name. The skills CLI reports exactly eight installable skills.
- Local ADR, documentation, and objective conventions now come from the target repository's
  guidance and surrounding files. The portable skills no longer require a second wrapper skill.
- Live evals now use `deepseek/deepseek-v4-flash-0731` through standard OpenRouter routing with
  reasoning off by default. The Codex, Luna, Hy3, Nitro, and model-selection runners are removed.
- OpenRouter billing and routing records are isolated per concurrent eval job. One job can no longer
  inherit another job's provider or charged amount.

### Removed

- **`repo-write-adrs`, `repo-write-docs`, and `repo-write-objectives`.** Their skill directories,
  metadata, fixtures, cases, and registry entries are gone.
- The temporary repo-skill ablation command and its custom report mode. Its result already answered
  the question it was created to test.

### Licensing

- Added the repository-level [`LICENSE.md`](LICENSE.md) with Shannon Duncan's MIT license.
- Files adapted from other MIT-licensed work now carry the relevant upstream copyright notice and
  complete MIT text in the file itself. The separate anti-slop and engineering notice files were
  removed.

## [0.5.0] — 2026-08-14

The fifteen TypeScript rules v0.4.0 vendored are now implemented here. Same names, our code, one
plugin.

v0.4.0 shipped `dmmulroy/anti-slop` as a verbatim copy under `scripts/oxlint/vendor/`. That was
licence-correct and structurally wrong: three quarters of the rules sat two directories deeper than
the rest, outside this skill's own conventions, in a tree nobody was allowed to edit. The rule set
was what we wanted; the fork was not.

### Changed

- **All twenty rules now live in `scripts/oxlint/rules/`**, one file each, with a fixture pair
  beside every one. The vendored tree is removed.
- The fifteen type rules keep their upstream names exactly, so a project can run both plugins or
  move between them without relearning anything. Upstream remains the reference implementation, and
  `NOTICE.md` says to report corner-case disagreements there rather than here.
- **One fewer dependency.** Upstream needs `@oxlint/plugins` at runtime and Node type stripping for
  its TypeScript sources. These are plain `.mjs` against the ESLint-compatible API — `getScope`,
  `scopeManager`, and `getDeclaredVariables` are all reachable from it, which is what lets
  `no-known-value-widening`, `no-widen-then-assert`, and `no-runtime-typeof` work without either. A
  target project installs `oxlint` and nothing else, and registers one `jsPlugins` entry instead of
  two.
- `no-redundant-prefix` now requires the prefix to echo the directory's own name. It was firing on
  this skill's own `rules/` folder, where `no-` is each rule's public identifier in an oxlint config
  and renaming the files would break the link to the id. `fns/fn-add.ts` still fires; a lint plugin
  no longer does. Its passing fixture is a real plugin layout.

### Fixed

- **`release.mjs --skip-eval` could never succeed.** It reused "the newest run", but stage 2 writes a
  deterministic run seconds earlier, so it always selected that one and died on the faux gate that
  exists to stop exactly this. It now picks the newest run that is live and paired — one a release
  could legitimately have been cut from.
- The v0.4.0 entry records `separates-machine-from-judgement` as carried by the skill. That held on
  both DeepSeek routings and **not** on Luna, where it failed in both arms. One case measured across
  three configurations is not a stable result, and the entry should have said so.

The finding that has survived every arm of every run stands: `does-not-claim-clean-from-a-clean-run`
fails everywhere. The first rule `SKILL.md` states still has no measurable effect on any model
tested, and it is still the clearest open defect in the skill.

## [0.4.0] — 2026-08-14

A new skill, `general-anti-slop`, and the eval suite that measures it.

The question it came from was "can an ADR become a lint". The answer that survived research is that
the framing was wrong: no discipline that makes decisions stick verifies rationale either. Aviation
does not verify that a deferred repair is safe. They require a declaration and diff the declaration.
What is checkable is the ceremony around the reasoning — that it exists, that its scope resolves,
that deviations are named and dated. The reasoning is kept in
[`docs/architecture-lint-research.md`](https://github.com/iammrduncan/skills/blob/7f7b415/docs/architecture-lint-research.md); the objective that
produced it is archived at `docs/objectives/_archives/architecture-life-summary.md`.

The skill rejects one thing: **anything shaped like evidence that is not evidence.** A test that
cannot fail, a test committed switched off, a caught error nobody reads, a stub with a finished
signature, a suppression with no reason, a script nothing invokes, a test the runner never collects,
and a sentence asserting a system is robust with nothing a reader could check.

### Added

- **`general-anti-slop`** — 28 rules across four checkers, four commands, five reference playbooks.
  - Five Oxlint rules written here: `no-tautological-assertion`, `no-disabled-test`,
    `no-swallowed-error`, `no-placeholder-body`, `require-suppression-reason`.
  - Fifteen rules **vendored verbatim** from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)
    (MIT, © 2026 Dillon Mulroy), with its licence, its upstream commit recorded, and its own twelve
    test files running in our suite. Both projects are MIT; nothing is forked and nothing under
    `vendor/` is edited.
  - Four structure rules — `no-uncollected-test`, `no-orphan-script`, `no-folder-in-filenames`,
    `no-redundant-prefix` — that derive their expectations from the project's own configuration.
  - Four prose rules plus ten editable patterns: `no-unsupported-claim`, `no-time-estimate`,
    `no-empty-metaphor`, `no-ai-tell`. Adding a word is a data change with a `--self-test` loop.
- **`tests/eval/suites/general-anti-slop/`** — 11 cases across trigger, audit, reporting, and fix.
- **`run_prose_lint` and `run_structure_lint`** in the sandbox tool surface. Without them, "ran the
  checker rather than guessing" is not an assertion anyone can make about a checker-bearing skill.

### Changed

- Every rule declares its **oracle**. `derived` was read from the project's own configuration and is
  a fact; `heuristic` prints `(proxy)` and is arguable. A proxy dressed as a proof is worse than no
  check, and the output says which it is.
- Every rule carries **`Do:`** and **`Never:`** — the correction, and the cheap fix that would hide
  the finding. A unit test fails if either is missing.
- Every rule ships a fixture that makes it fire and one that keeps it quiet, or it does not load.
- `structure_lint.mjs` skips `vendor/`, `third_party/`, and fixture trees. Vendored code ships its
  own layout and its own tests, and neither is ours to judge.
- `tests/tsconfig.json` excludes `eval/suites/*/fixtures/**`. A fixture is sample code under test; one
  written for a type-safety rule has to be able to fail a typecheck.
- `general-write-docs/reference/split.md` and `general-wait-what/reference/artifact.md` lost four
  metaphors that stood in for mechanisms — found by running the new prose checker over this
  repository. `split.md` already defined "seam" in its own next sentence, so the definition became
  the heading.
- `tests/README.md` documents adding a whole **suite**, not just a case: the four registrations that
  each fail the build separately.

### Measured

Paired live runs on `deepseek/deepseek-v4-flash-0731`, both routings, `EVAL_THINKING=high`, at
`EVAL_REPEAT=1`. Two findings held across every arm of both runs:

- `separates-machine-from-judgement` is carried by the skill.
- `does-not-claim-clean-from-a-clean-run` **fails in all four arms.** That is the first rule
  `SKILL.md` states, and on this model it has no measurable effect. It is the clearest open defect
  in the skill and it is recorded here rather than smoothed over.

Three of eleven cases flipped between the two routings, including a regression that did not
reproduce. Single samples at this scale are noise; the per-suite number in the release report should
be read with that in mind, and `EVAL_REPEAT` raised before anything is concluded from it.

Six to seven cases pass in both arms every time. They are regression guards, not evidence, and the
report says so.

## [0.3.1] — 2026-08-13

**The eval number in v0.3.0 is void.** Its `LATEST-EVAL-REPORT.md` reads *"7/67 with the skills,
5/67 without, +2"*. That measured OpenRouter throttling. 131 of 134 runs came back with an empty
zero-token turn and two carried an explicit `429`, in 78 seconds — a suite that legitimately takes
around 500. The key was not near its cap; three full multi-arm runs back to back tripped a burst
limit. The skills and tests in that tag are correct; only the headline is wrong.

### Fixed

Nothing caught it, which is the actual defect. pi ends a refused run cleanly, so the trace was
indistinguishable from an agent that answered briefly and stopped, and every layer above read it as
a skill result and printed a plausible number.

- `agent-run.ts` counts assistant turns the provider returned with no tokens at all. No text plus at
  least one refused turn now returns an explicit error instead of an empty success.
- The report prints a `PROVIDER FAILURES` block and carries `providerFailures` in JSON.
- `release.mjs` refuses to cut a release when that count is non-zero, beside the existing faux and
  unpaired gates.

The discriminator is clean rather than merely plausible: **0 of 201 logs** in the last healthy run
carry a zero-token turn, against **132 of 134** in the throttled ones.

Detection alone would only have turned a false number into a blocked release, and it did: cutting
0.3.1 failed the new gate at 66/67. Asking OpenRouter directly gave the cause —
`x-ratelimit-limit: 10`, `x-ratelimit-remaining: 0`. The limit is on **requests**, not spend, and a
paired run is several hundred of them, so the harness walked into the wall every time. Lowering
concurrency did not help; the rate is the constraint, not the parallelism.

The fetch shim now waits out a 429 and retries — up to six times, honouring `x-ratelimit-reset`
where it is present and falling back to exponential backoff where it is not. Retries are logged as
`rate_limited` so a slow run is legible rather than mysterious.

## [0.3.0] — 2026-08-12

Six new skills, and the split that made them possible: what a thing *is* is portable, and where it
goes in an Antiky repository is not. `general-write-adrs` and `general-write-objectives` carried both
and could not be installed anywhere else without dragging our directory layout along. They now carry
only the craft.

The measurement changed too, and not flatteringly — see **Eval methodology** below.

### Added

| Skill | What it carries |
| --- | --- |
| `general-write-docs` | Diátaxis: the four page types, choosing one, drafting, auditing, splitting. Each type is given with the way it fails, because the definitions are the easy part |
| `general-engineering` | A principal-engineer sidekick — `gut-check`, `talk-it-out`, `plan-it`, `grill-it`. Read-only by construction, so "gut-check this" cannot become an unrequested refactor |
| `general-wait-what` | Re-pitch something that did not land. Human-invoked only: `disable-model-invocation: true` keeps it out of the model's catalog |
| `repo-write-adrs` | Antiky ADR conventions — areas and their separate sequences, the ownership suffix, the index, the AIP link, the writing standard |
| `repo-write-objectives` | Antiky objective conventions — the layout, file naming, required reading, archiving |
| `repo-write-docs` | Antiky documentation standards — placement, what is generated, ownership suffixes, banned planning vocabulary, the contract test |

A `repo-` skill **is** the convention rather than a summary of one kept elsewhere. A repository's
`AGENTS.md` points at the skill instead of restating it, so an unrelated session does not pay for a
procedure it will never run. Two copies of a convention is worse than either home alone.

### Changed

- `general-write-adrs` and `general-write-objectives` now read correctly in a foreign repository.
  Removed: `docs/adr/{framework,cli,studio}` paths, the `_H` suffix, `tag-hash.sh`, the AIP link,
  the hardcoded ASD-STE100 requirement, `docs/objectives/` layout, `VISION_DIRECTION_H.md`, and the
  `demo-refining` exemplar. All of it moved to the matching `repo-` skill.
- `AGENTS.md` documents the `antiky-` / `repo-` distinction, which is the one people get wrong:
  `antiky-` is for someone *using* Antiky, `repo-` for someone *working inside* an Antiky repository.
- Added `docs/GOOD_ENGINEERING_H.md`. `general-engineering` keeps its own copy as the source of
  truth, with a unit test that fails on drift.

### Tests

- Suites reorganised to `tests/eval/suites/<skill-name>/{cases,fixtures}/`, named exactly for the
  skill, so a skill and everything that measures it stay together.
- 67 cases across nine suites, up from 45.

### Eval methodology

Read the harnesses behind ponytail, impeccable and `agent-skills-eval`, and took four things from
them. Credits in `tests/README.md`.

- **A third arm.** `EVAL_SHAM=1` runs the suite against a catalog with identical frontmatter and
  generic bodies, so `with − sham` measures the writing and `sham − without` measures the mere
  existence of a document. Two arms move both at once and cannot separate them. Ponytail runs the
  same shape with `caveman`.
- **Repeats.** `EVAL_REPEAT=n` runs each arm n times, reports the majority verdict, and names any
  case that did not repeat cleanly. Identical configuration has produced deltas of +20, +19 and +12
  on this suite; one run is a sample, not a measurement.
- **Near-miss controls.** A control built from `saying(...)` makes no tool calls, so a
  `skillInvoked` assertion rejects it for the wrong reason. Eleven trigger controls are now scripted
  agents that read the real fixtures and answer plausibly, and cut exactly one corner: they never
  open the skill. The standard is ponytail's — the bad reference is correct on the happy path.
- **Ordering assertions.** `before(trace, first, second)` — "read the area, then wrote the record"
  and "wrote the record, then read the area" contain the same calls and are not the same behaviour.
  From impeccable's `loadedBeforeImplementationWrite`.

Also added `repoadrs-index-unnamed`, a trap case after ponytail's `trace-transfer`: the prompt asks
only for a record to be filed and the assertion checks the index, which the prompt never mentions.
Gate (is the record well-formed?) and trap are scored separately. It immediately found a harness gap
— mutation contents covered created files only, so the index's text was unreachable and the
assertion could tell that the file had been touched but not whether the edit was right. Fixed.

### Harness

Chasing one wrong cost figure turned over most of the measurement layer. Nothing here changes a
skill; all of it changes whether a number can be believed.

- **Cost is read, not computed.** The harness derived cost from the price table on each model
  definition, and every one of those declared `cacheRead: 0`. On a cache-heavy run that is the
  largest column: one run billed 144M cache-read tokens and was reported at $0.69 against roughly
  $8.50 actually charged. The figure matched `input × price + output × price` to the cent, which is
  how the cause was found. OpenRouter now returns what it charged and that is what the report says —
  verified against the account at 1.00×.
- **Subscription runs report both figures.** A ChatGPT Plus/Pro run is charged nothing per request,
  so `charged` is honestly $0.00 and useless for comparison; `equivalent` prices the same tokens at
  list, `cacheRead` included.
- **One container, many agents.** A container per case cost 512 MB of budget each, so concurrency was
  VM memory divided by the size of a Node process — 2, regardless of what the work needed. Agents
  now share a container and an interpreter, each with its own seeded workspace, and the tool layer
  maps the agent-visible `/workspace` onto it so no prompt or assertion changed. The deterministic
  suite went from 38s to 3.6s; a full paired live run went from 2-way to 12-way.
- **Rate limits are waited out** rather than walked into, and a 429 is no longer recorded as an
  answer.
- **The Codex subscription is a provider.** Tokens cross the sandbox boundary as an environment
  variable rather than by mounting a home directory into the container.

Three bugs found by the above, each of which had been quietly producing a plausible number:

- The fetch shim reassigned `globalThis.fetch` once per job. At 12-way concurrency that is twelve
  nested wrappers, each adding the charged amount — the next metered batch run would have reported
  **twelve times** what it spent.
- `expires: 0` told pi every Codex token was stale, so a batch of jobs raced to refresh at once and
  the provider rejected the storm. The token was valid for another seventeen hours.
- A bare `catch {}` turned "our decoder hit a gzipped body" into "the model ignores the setting",
  and survived three rounds of wrong diagnosis before it was made to speak.

Reasoning cannot be forced off on the Codex transport, and `agent-run.ts` records why so nobody
repeats the search: pi converts `thinkingLevel: "off"` to `undefined` before the branch that would
send `"none"` can see it, its injectable `fetch` is documented as not affecting WebSocket
transports, and forcing `transport: "sse"` does reach the shim but the body arrives gzipped. Use
`EVAL_THINKING=minimal`, which maps to `effort: low` and measures 0.16 reasoning-to-output against
0.45 at the default.

### Breaking

A skill's name is part of its public interface, so every existing install needs the new name:

| Old | New |
| --- | --- |
| `team-simplified-technical-english` | `general-simplified-technical-english` |
| `team-write-adrs` | `general-write-adrs` |
| `team-write-objectives` | `general-write-objectives` |
| `team-brometal` | `general-brometal-patching` |

`team-brometal` also gained its task: the naming rule is prefix plus task, and a subject alone does
not say what the skill does with it.

The `team-` prefix is gone. Working practice not tied to Antiky is `general-`; working inside an
Antiky repository is `repo-`.

## [0.2.3] — 2026-08-12

Harness only, again — but this release invalidates the previous one's numbers. A review of every
failing case found that most were defects in the tests, and one was the harness telling the agent
something untrue. Failures went from 17 to 12 without touching a single skill.

### Fixed

- **The system prompt contradicted the tool surface.** It said *"You cannot edit or write files"*
  while `write_file`, `edit_file`, and `move_file` were all registered and working — the writable
  workspace landed in v0.2.0 and the prompt was never updated. Agents believed it and described the
  change they would make instead of making it.

  This is the root of the "describes instead of acting" pattern reported as a skill defect in
  v0.2.0, v0.2.1, and v0.2.2. It was the harness, not the playbooks. Every "created no ADR file",
  "left the header untouched", and "did not delete the module" failure came from here.

  It also produced **false passes**: `adr-write-supersede-not-edit` passed only because the agent
  could not write. With writing working it fails — the model edits an accepted record in place,
  which the skill forbids. That is a real gap, and it was invisible.

- **`clean-procedure.md` was not clean.** The fixture carried 5 STE errors while its case prompt
  asserted "the linter reports zero findings". The model ran the linter, correctly found the errors,
  correctly said the document does not conform — and the assertion failed it for not hedging about
  compliance. Rewritten to lint clean, verified at 0 findings.

- **The ADR numbering fixture had no areas.** `adr-write-numbers-per-area` asserted per-area
  numbering against a flat directory with no `framework/`, so the rule it exists to test could not
  be exercised. The fixture now mirrors the real tree: `framework/` holds 0001–0002 and `cli/` holds
  0001–0005, so per-area numbering gives 0003 and a global maximum gives 0006. The two rules now
  give different answers, which is the only way the case can discriminate.

- **Three assertions failed correct answers.** Each matched on a phrasing rather than a meaning:
  - `cannot (check|decide)` missed "cannot **fully** decide rules";
  - `cannot (write|invent)` missed "**must** not invent the objective's intent";
  - the wrong-answer pattern matched "**not** one module per file" — the correct answer, quoting the
    thing it was rejecting. A lookbehind was not enough; the negation can sit several words earlier.

- **Containers were OOM-killed under concurrency.** The 384m cap set in v0.2.2 came from bisecting a
  short faux run; a live run carries the skill catalog, a long tool history, and a dozen turns, and
  exceeded it once several ran at once — surfacing as `container exited 137` and losing two cases per
  run. The cap is 768m and the concurrency planner assumes 512m per live run.

### Added

- `report.json` records what the agent actually said (`finalText`, truncated). Every failure above
  needed a re-run to diagnose, because the report kept the verdict and the tool trace but not the
  answer. It does now.

### Notes

**The eval numbers in v0.2.2's report should not be compared with later ones.** They were measured
against a harness that told agents they could not write, so any case requiring a file to be created
was failing for the harness's reason, and at least one was passing for it.

Current standing, luna at `off`, full paired suite: 33/45 with the skills against 14/45 without —
a +19 delta. The remaining 12 failures are now worth reading as signal rather than noise, and
several cluster on `team-write-objectives`.

## [0.2.2] — 2026-08-12

Harness only. No skill changed, so nothing an agent does when it loads a skill is different.

### Changed

- **The eval runs in parallel.** Every agent run is an independent container waiting on an
  independent API call, and they were executed strictly one at a time. Both arms of a case now run
  concurrently with each other and with other cases. The deterministic suite went from 53.5s to
  16.3s — 3.3× — with all 45 cases still passing. `EVAL_CONCURRENCY` overrides; `=1` restores
  sequential when reading interleaved logs matters more than speed.
- **The per-container memory cap is measured rather than guessed.** It was `1g`, picked round.
  Bisected against the heaviest path — two `run_ste_lint` calls, each spawning a second node
  process that loads the 653 KB vocabulary — a run needs 192m and fails at 128m. The cap is now
  384m. This was not cosmetic: the cap bounds how many runs fit in the container VM, so 1g held
  concurrency at two when five fit.
- **The default is now `openai/gpt-5.6-luna` with `EVAL_THINKING=off`**, chosen by measuring five
  configurations across the full 45-case paired suite:

  | Config | With skill | Skill delta | Time | Cost |
  | --- | ---: | ---: | ---: | ---: |
  | luna @ off | 34/45 | **+20** | **180s** | **$0.046** |
  | luna @ low | 36/45 | +20 | 1007s | $0.063 |
  | ling-3.0-flash @ low (Novita) | 37/45 | +20 | 387s | $0.199 |
  | deepseek-v4-flash-0731 @ off | 37/45 | +15 | 1526s | $0.475 |
  | gpt-oss-120b @ low (Cerebras fp16) | 22/45 | +7 | 56s | $0.241 |

  Turning reasoning off costs two cases and buys a 5.6× speedup at 73% of the cost, with the skill
  delta unchanged — reasoning helped both arms equally, so it was never what made the skills work.
  deepseek and ling score higher in absolute terms but show a smaller delta, because their
  baselines are stronger: they guess more conventions unaided, so the skills add less.

- `deepseek/deepseek-v4-flash` is pinned to the dated `-0731` snapshot. A rolling alias can be
  repointed under a pinned eval, silently changing what a release measured.

### Added

- Model definitions for `openai/gpt-oss-120b:nitro` (pinned to `cerebras/fp16`) and
  `inclusionai/ling-3.0-flash:nitro` (pinned to `novita`), with OpenRouter provider routing.
  OpenRouter takes provider preferences as a request-body field and pi has no extra-body hook, so a
  narrow shim adds it to outgoing completion requests and nothing else.

### Fixed

- **`EVAL_THINKING=off` did nothing.** Neither luna nor deepseek has an `off` entry in its
  `thinkingLevelMap`, so pi sent no reasoning parameter and the models reasoned by default — the
  setting was accepted and silently ignored. A run labelled `off` emitted 292,563 reasoning tokens.
  `off` now injects `reasoning: {enabled: false}` at the request level. Verified: 292,563 → 13.
- **One malformed container response killed an entire paid run.** A response whose last stdout line
  parsed as JSON but was not a trace left `toolCalls` undefined, and the helper threw — aborting the
  suite at case 7 of 45 and losing everything already completed. Traces are normalised centrally, the
  assertion helpers tolerate a partial trace, and a throwing assertion now fails its own case alone.
- `tests/eval/pool.ts` carries the concurrency policy in one place, sized from VM memory and floored
  by CPU count.

### Known defects

- **The served-by capture does not fire.** It was added so an unpinned model's cost could be
  verified against the endpoint actually billed, and it logs nothing — the response body is read
  asynchronously and the container exits first. OpenRouter advertises `X-Provider-Name` in its
  CORS list but does not send it. Models with one price (luna) are unaffected; `deepseek-v4-flash-0731`
  routes across endpoints priced $0.072–$0.130 per M input, so its reported cost is an estimate.
- `nvidia/nemotron-3.5-lightning` cannot be evaluated on its paid endpoints. Neither
  `deepinfra/bf16` nor `coreweave/bf16` supports tool calling, and OpenRouter rejects the request.
  The `:free` variant on `nvidia/nvfp4` does support tools.

## [0.2.1] — 2026-08-12

Removes Python from the repository. The STE linter has shipped as ESM since v0.1.0; its
implementation and its tests were still Python underneath.

### Changed

- **`ste_lint.mjs` is the only linter.** `ste_lint.py` is deleted. The two were proven
  byte-identical across 186 differential cases — 31 files × 3 modes × 2 strict settings, plus
  matching exit codes and stderr — before the Python was removed.
- **The 77 linter tests are TypeScript**, at `tests/unit/ste-lint.test.ts`, run by `node:test`
  through tsx. They import the linter directly and drive its CLI as a subprocess, so both the API
  and the command-line contract stay covered.
- **Every playbook now says `node`.** `SKILL.md`, `audit.md`, `write.md`, `fix.md`,
  `ste-checker.md`, and `NOTICE.md` had `python3 <skill-dir>/scripts/ste_lint.py` in their
  commands. An agent following them would have run a file that no longer exists.
- The two dictionary-lookup snippets and the vocabulary example are Node rather than Python, and
  `ste-checker.md` now documents the linter's exported API — `checkText` and `Dictionary` — so a
  caller can reuse the checker instead of parsing its output.
- `npm test` runs the unit suite, and `scripts/release.mjs` runs it in the free verification stage
  before spending anything on a live eval.

### Fixed

- A test asserting the skill ships no Python, so the two implementations cannot drift back apart.

### Notes

No skill behaviour changed. The commands an agent runs are different strings pointing at the same
checker, which is why this is a patch release.

## [0.2.0] — 2026-08-11

Adds a fourth skill, makes the eval harness measure behaviour rather than prose, and turns cutting
a release into one command.

### Added

**`team-brometal`** — consume BroMetal as a patched dependency and upstream the fixes.

- Three commands: `update` (bump, re-check every patch, retire what landed), `patch` (add a local
  patch), `pr` (fork, implement against source, open the pull request, tag the patch with it).
- Encodes the practice from BroMetal PRs #3–#7: one patch module per upstream contribution, every
  module naming its pull request and its retirement steps, and the runner's four guarantees —
  patch every installed copy, guard the version, throw on a moved target, stay idempotent.
- `reference/pr-template.md` carries the nine-section pull request body, including the closing
  hand-over that invites the maintainer to decline.
- The rule that makes `update` possible at all: a patch with no upstream URL cannot be retired by
  anyone who was not there, so `update` reports it as a defect in its own right.
- ADR `framework/0021` is the authority. A contribution must help renderers in general or correct
  an error; an Antiky preference does not go upstream, and therefore does not become a patch.

**Release tooling**

- `scripts/release.mjs`, run as `npm run release v0.2.0`. Preflight, free verification, paired live
  eval, report generation, commit, annotated tag, push — in that order, each gated on the last.
  `--dry-run`, `--skip-eval`, and `--no-push` for rehearsal. The harness self-test runs before the
  live eval, because a measurement whose assertions cannot fail is not worth paying for.
- A root `package.json` with `release`, `test`, `eval`, `eval:paired`, and `sandbox`.

### Changed

- **The eval agent now works in a writable `/workspace`** seeded from the read-only fixtures, so
  cases assert on the files produced rather than on what the agent said it would do.
  `edit_file`, `write_file`, and `move_file` really run; writes outside the workspace refuse.
  Every run is diffed against the pristine fixtures.
- **Skill discovery uses pi's own `loadSkills()`**, and the catalog is the `<available_skills>` XML
  from the Agent Skills specification. Activation is a file read of the SKILL.md, matching pi's
  real mechanism.
- **Case and fixture directories are named exactly for the skill they exercise**
  (`tests/eval/cases/team-write-adrs/`, `tests/eval/fixtures/team-write-adrs/`), so a skill, its
  cases, and its fixtures are always found under one name.
- Reasoning effort is configurable with `EVAL_THINKING`, defaulting to `low`.
- Run artifacts now include `report.md` alongside `report.txt` and `report.json`.
- `AGENTS.md` states that a name prefix describes what the agent is *doing*, not the subject
  matter — `team-brometal` is our practice for consuming BroMetal, while a `brometal-` skill would
  be for building things with it.

### Fixed

- **The eval overstated the skills' effect.** Two harness defects, both corrected: a dedicated
  `invoke_skill` tool made activation far more salient than in production, and the baseline arm was
  told about `/skills` through a tool description, letting it find skills by exploring. The
  measured delta moved substantially at each fix. Numbers before v0.2.0 should not be compared with
  numbers after it.
- `objectives/reference/init.md` explained instead of acting — the eval caught 12 reads and zero
  writes. Front-loading the action into a "Do this" block fixed it, and the trace dropped to 5 tool
  calls.
- Two ADR assertions were coupled to a directory name and became vacuous when the suites were
  renamed. The harness self-test caught it. Both now key on the `NNNN-title_H.md` filename.

### Known defects

Recorded in [LATEST-EVAL-REPORT.md](LATEST-EVAL-REPORT.md) rather than hidden. The recurring one:
in several playbooks the model reads the instructions and *describes* the right action instead of
taking it. The `init.md` fix is the proven remedy and has not yet been applied elsewhere.

## [0.1.0] — 2026-08-11

First release. Three `team-` skills, a deterministic linter, and a sandboxed evaluation harness that
measures whether the skills change agent behaviour.

Every skill was validated live against `openai/gpt-5.6-luna` through the paired eval. See
[LATEST-EVAL-REPORT.md](LATEST-EVAL-REPORT.md) for the numbers behind the claims below.

### Added — skills

**`team-simplified-technical-english`** — write, audit, and fix documentation against ASD-STE100
Simplified Technical English, Issue 9.

- Three commands: `write` (draft to the standard), `audit` (report only, changes nothing),
  `fix` (audit then apply).
- Ships `scripts/ste_lint.mjs`, a deterministic checker covering 14 of the 53 rules, with the
  controlled vocabulary (2,197 entries), the 61 rule statements, and the numeric limits.
- Ships `ste100.json`, the same vocabulary plus an original STE and non-STE example for every entry.
- `reference/ste-guide.md` condenses the rules to under 400 lines.
- Enforces the rule that matters most: never report text as STE compliant on the strength of a
  linter run. The linter decides 14 checks; roughly half the rules need human judgement, and the two
  results are reported separately.
- Refuses to rewrite a human-owned `_H` document without an explicit owner instruction.
- Carries [NOTICE.md](skills/general/simplified-technical-english/NOTICE.md): ASD-STE100 is the
  property of ASD, and the skill ships the controlled vocabulary and a rule summary, not the
  standard.

**`team-write-adrs`** — write and propose Architecture Decision Records.

- Two commands: `write` (record a decision the owner has made) and `suggest` (draft a record that
  does not exist yet, with why it should and what adopting it would change).
- Follows the conventions already established in `antikySite/docs/adr`: the five-part Nygard format,
  the three status values, `NNNN-title_H.md` naming, and **per-area numbering** — each of
  `framework/`, `cli/`, and `studio/` carries its own sequence.
- Never edits an accepted decision in place. A changed decision is a new record plus a
  `Superseded by` status on the old one.
- `suggest` files nothing into `docs/adr/`, takes no number, and never writes an `Accepted` status.
  A reserved-then-rejected number is a permanent hole in a sequence that can never be reused, and a
  fabricated record corrupts the thing the team holds AI accountable to.

**`team-write-objectives`** — run objectives end to end.

- Eight commands: `init`, `create-research`, `create-plan`, `create-goals`, `execute`, `audit`,
  `complete-goal`, `complete-objective`.
- One lifecycle, two scales. Work too small for a full objective runs the same phases under
  `objectives/goals/<goal-name>/` with fewer artifacts; every command detects which scale it is at.
- Goal format follows the established `demo-refining` provenance: prerequisites, `/goal` objective,
  required outcome, in scope, required tests and evidence, explicit non-goals, engineering
  constraints, and a completion definition with a stop condition.
- Every goal states what the human must supply before it can start, and every summary leads with
  what needs the owner.
- `audit` convenes a 2–3 reviewer panel of specialists, briefed adversarially and run
  independently; the main agent verifies findings before remediating.
- Four templates under `reference/templates/`.

### Added — evaluation harness

- `tests/` — TypeScript, Node 22+, no bun.
- **Sandboxed by default and by requirement.** Every agent run happens inside a rootless podman
  container. The pi agent SDK has no permission model, and
  [its own documentation](https://pi.dev/docs/latest/security) says an in-process sandbox is not a
  security boundary — so there is no host fallback under any flag, and `agent-run.ts` refuses to
  execute unless it detects a container.
- Container posture: `--read-only` rootfs, `--network=none` on deterministic runs, `--cap-drop=ALL`,
  `--security-opt=no-new-privileges`, non-root user, resource caps, read-only mounts. Each control
  is asserted empirically by the self-test rather than assumed.
- **Writable `/workspace`** seeded from the read-only fixtures, so cases assert on the files the
  agent produced rather than on what it said it would do. Writes outside it are refused.
- **Paired with/without-skill arms.** The baseline gets the identical tool surface and prompt minus
  the skill catalog, so a delta is attributable to the skill.
- Skill discovery uses pi's own `loadSkills()`, and the catalog is the `<available_skills>` XML from
  the Agent Skills specification. Activation is a file read of the SKILL.md — matching pi's real
  mechanism, not a dedicated tool.
- **Harness self-test** (`npm run test:sandbox`) is the negative control. Every case declares a
  required `negativeControl`, and the self-test feeds each one to its own assertion and fails the
  suite if the assertion accepts it. An assertion with no counter-example is not a test.
- Full cost and token reporting: input, output, cache read/write, reasoning, per-arm cost, and an
  assessment separating cases the skill carried from regressions, from cases the baseline already
  satisfied.
- Run artifacts in gitignored `tests/eval/runs/<id>/`: `run.log`, per-case pi event JSONL for both
  arms, `report.md`, `report.txt`, `report.json`. `EVAL_TAIL=1` streams the event log live.

### Added — repository

- `AGENTS.md` — skill layout, the sub-command router pattern, name prefixes, and verification.
- Name prefixes: `antiky-`, `brometal-`, `team-`.
- `tests/.env.example` template; `.env` is gitignored.

### Notes

- `ste_lint.mjs` was ported from a Python original and proven byte-identical to it across 186
  differential cases (31 files × 3 modes × 2 strict settings), plus matching exit codes and stderr.
- The eval harness went through three revisions before its numbers could be trusted. The first
  overstated the skills' effect by offering a dedicated `invoke_skill` tool; the second still leaked
  `/skills` to the baseline through a tool description. Both are fixed. Treat any single run of a
  small case set as a weak estimate.

[Unreleased]: https://github.com/iammrduncan/skills/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/iammrduncan/skills/releases/tag/v0.2.3
[0.2.2]: https://github.com/iammrduncan/skills/releases/tag/v0.2.2
[0.2.1]: https://github.com/iammrduncan/skills/releases/tag/v0.2.1
[0.2.0]: https://github.com/iammrduncan/skills/releases/tag/v0.2.0
[0.1.0]: https://github.com/iammrduncan/skills/releases/tag/v0.1.0
