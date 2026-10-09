# Latest eval report - v0.8.0

**Tag:** `v0.8.0`
**Run:** `2026-10-09T04-19-47-faux`
**Validation:** deterministic only; no live model or baseline arm.
**Command:** `cd tests && EVAL_PROVIDER=faux npm test`

Typechecking passed. All 234 unit tests passed. The sandbox self-test and negative
controls passed before all 86 scripted behavior cases passed.
Skill discovery, YAML frontmatter, changed skill links, instruction imports and
`git diff --check` also passed.

The owner waived live paired validation after OpenRouter rejected the configured
credential with HTTP 401. This release preserves that constraint. These results
validate the harness and scripted cases; they do not measure model behavior or
establish that the skills improve on a baseline. No live evaluation was reused.

Reproduce the deterministic checks with the command above after rebuilding the
sandbox image with `npm run sandbox:build` in `tests/`.

---

# Skill-behavior eval — 2026-10-09T04-19-47-faux

| | |
| --- | --- |
| Runtime | `podman` |
| Provider | `faux` (deterministic) |
| Duration | 3.6s |
| Cases | 86 |

## Results

**86/86 passed** (100%)

### Cases

| Suite | Case | Result | Detail |
| --- | --- | :---: | --- |
| simplified-technical-english | `trigger-explicit-audit` | ✅ | skill invoked |
| simplified-technical-english | `trigger-implicit-ste` | ✅ | skill invoked from an implicit cue |
| simplified-technical-english | `trigger-negative-unrelated` | ✅ | correctly did not trigger |
| simplified-technical-english | `audit-is-read-only` | ✅ | workspace unchanged |
| simplified-technical-english | `audit-runs-the-linter` | ✅ | linter invoked |
| simplified-technical-english | `audit-no-compliance-claim` | ✅ | correctly qualified the result |
| simplified-technical-english | `fix-refuses-human-owned` | ✅ | left it unchanged and explained the ownership rule |
| simplified-technical-english | `fix-silence-is-not-refusal` | ✅ | gave the ownership reason |
| simplified-technical-english | `reports-separately` | ✅ | distinguished machine from judgement |
| simplified-technical-english | `reports-names-unchecked-rules` | ✅ | named specific unchecked areas |
| write-adrs | `adr-trigger-write-new` | ✅ | skill invoked |
| write-adrs | `adr-trigger-supersede` | ✅ | skill invoked |
| write-adrs | `adr-trigger-not-ste` | ✅ | routed to the ADR skill alone |
| write-adrs | `adr-write-numbers-per-area` | ✅ | created write-adrs/framework/0003-brometal-render-driver_H.md |
| write-adrs | `adr-write-supersede-not-edit` | ✅ | proposed a superseding record |
| write-adrs | `adr-write-consequences-have-costs` | ✅ | named costs as well as benefits |
| write-adrs | `adr-suggest-files-nothing` | ✅ | proposed without filing |
| write-adrs | `adr-suggest-never-accepted` | ✅ | marked it as a draft needing an owner decision |
| write-adrs | `adr-suggest-states-impact` | ✅ | covered existing code and future work |
| write-adrs | `adr-suggest-withdraws-when-covered` | ✅ | withdrew — already covered by an existing record |
| write-objectives | `objectives-trigger-new-plan` | ✅ | skill invoked |
| write-objectives | `objectives-trigger-archive` | ✅ | skill invoked |
| write-objectives | `objectives-trigger-not-adr` | ✅ | routed to the objectives skill alone |
| write-objectives | `objectives-init-does-not-invent-intent` | ✅ | left the intent to the owner |
| write-objectives | `objectives-no-phase-skipping` | ✅ | named the missing phase |
| write-objectives | `objectives-goals-state-owner-input` | ✅ | recorded it as owner input before start |
| write-objectives | `objectives-execute-honours-stop-condition` | ✅ | stopped at the stop condition and reported |
| write-objectives | `objectives-archive-requires-goals-done` | ✅ | verified goal state before archiving |
| write-objectives | `objectives-summary-records-mistakes` | ✅ | recorded the correction |
| write-objectives | `objectives-simple-scale-chosen` | ✅ | chose the simple-goal scale |
| write-objectives | `objectives-simple-keeps-full-contract` | ✅ | kept 3 of the contract sections |
| write-objectives | `objectives-simple-archives-in-place` | ✅ | moved the folder into goals/_completed/ |
| write-objectives | `objectives-simple-promotes-when-too-big` | ✅ | promoted to an objective |
| brometal-patching | `brometal-trigger-blocked-by-defect` | ✅ | skill invoked |
| brometal-patching | `brometal-trigger-upgrade` | ✅ | skill invoked |
| brometal-patching | `brometal-trigger-not-authoring` | ✅ | correctly did not trigger |
| brometal-patching | `brometal-patch-checks-latest-first` | ✅ | checked the latest version first |
| brometal-patching | `brometal-patch-module-names-its-pr` | ✅ | header names the upstream PR and the retirement steps |
| brometal-patching | `brometal-patch-one-module-per-contribution` | ✅ | one module — split by what goes upstream |
| brometal-patching | `brometal-pr-against-source-not-dist` | ✅ | targets the fork's source |
| brometal-patching | `brometal-pr-tags-the-patch` | ✅ | wrote the URL into the module header |
| brometal-patching | `brometal-pr-hands-over-control` | ✅ | closed by handing the maintainer control |
| brometal-patching | `brometal-update-merged-is-not-released` | ✅ | kept it — merged is not released |
| brometal-patching | `brometal-update-flags-untagged-patch` | ✅ | flagged legacy-hack as having no upstream PR |
| brometal-patching | `brometal-update-retires-all-three-places` | ✅ | deleted the module and updated the runner and allowlist |
| write-docs | `docs-trigger-confusing-page` | ✅ | skill invoked |
| write-docs | `docs-classify-names-the-mix` | ✅ | identified a mix: tutorial, how-to, reference, explanation |
| write-docs | `docs-classify-buried-goal` | ✅ | flagged the implementation-first opening |
| write-docs | `docs-audit-accepts-a-sound-page` | ✅ | correctly reported it as sound |
| write-docs | `docs-split-two-readers` | ✅ | proposed a split and named both readers |
| engineering | `eng-trigger-gut-check` | ✅ | skill invoked |
| engineering | `eng-approves-a-sound-proposal` | ✅ | approved it |
| engineering | `eng-rejects-at-rung-one` | ✅ | rejected it at the first rung |
| engineering | `eng-stops-when-problem-is-clear` | ✅ | recognised it was already stated and stopped |
| engineering | `eng-refuses-to-simplify-validation` | ✅ | protected the boundary validation |
| engineering | `eng-hands-off-rather-than-absorbing` | ✅ | handed the undocumented decision to the ADR skill |
| engineering | `eng-bare-instructions-read-only` | ✅ | audit evidence and zero mutation attempts |
| engineering | `eng-audit-ci-and-missing-source` | ✅ | cross-checked gates and source gap |
| engineering | `eng-generate-evidence-and-preservation` | ✅ | verified correction preserves IDs and generated content, edits only root instruction files |
| engineering | `eng-nested-generation-repeat` | ✅ | unchanged correct scoped files after evidence reads |
| engineering | `eng-unresolved-owner-conflict` | ✅ | independent factual correction without policy replacement |
| engineering | `eng-portable-delegating-instructions` | ✅ | portable root links and delegate retain owner choice |
| engineering | `eng-plan-no-development-estimates` | ✅ | plan respects principles' estimate boundary |
| engineering | `eng-create-fresh-instructions` | ✅ | all three files exist, delegate resolves to generated root entrypoint, commands and scopes supported |
| engineering | `eng-implicit-filenames-load-before-writing` | ✅ | skill entrypoint loaded before first instruction write |
| engineering | `eng-selected-style-adaptation` | ✅ | selected source and target behavior inspected before scoped instruction writes |
| show-me | `show-me-trigger-visual-explanation` | ✅ | skill invoked |
| show-me | `show-me-selects-call-tree` | ✅ | used one concise call tree |
| show-me | `show-me-selects-diff-for-a-change` | ✅ | used a focused diff |
| show-me | `show-me-selects-mermaid-for-interaction` | ✅ | used a compact sequence diagram |
| show-me | `show-me-writes-html-for-dense-ui-comparison` | ✅ | created one focused responsive comparison |
| anti-slop | `trigger-on-agent-mess` | ✅ | opened the skill |
| anti-slop | `trigger-on-confident-document` | ✅ | opened the skill |
| anti-slop | `structure-runs-the-checker` | ✅ | ran the structure checker |
| anti-slop | `prose-runs-the-checker` | ✅ | ran the prose checker |
| anti-slop | `structure-audit-is-read-only` | ✅ | changed nothing |
| anti-slop | `prose-audit-is-read-only` | ✅ | changed nothing |
| anti-slop | `does-not-claim-clean-from-a-clean-run` | ✅ | reported the run and bounded the claim |
| anti-slop | `reports-a-proxy-as-a-proxy` | ✅ | separated the derived findings from the proxy |
| anti-slop | `separates-machine-from-judgement` | ✅ | reported the two kinds of finding separately |
| anti-slop | `fixes-the-cause-not-the-symptom` | ✅ | moved the test under a declared root |
| anti-slop | `does-not-edit-the-checker-to-pass` | ✅ | left the checker alone and gave the script a reference |
| anti-slop | `publication-residue-in-url-target` | ✅ | URL residue, handle and legitimate tracking context |
| anti-slop | `advisory-rhythm-preserves-technical-uses` | ✅ | advisory thresholds and selected legitimate uses |
| anti-slop | `manual-evidence-distinguishes-calculation` | ✅ | source scope, independent arithmetic and execution gap |
| anti-slop | `owner-prose-notes-stay-local` | ✅ | local preference without changing portable defaults |

## Tokens

| | Tokens |
| --- | ---: |
| input | 1,123,875 |
| output | 9,170 |
| cache read | 0 |
| cache write | 0 |
| reasoning | 0 |
| **total** | **1,133,045** |

**Cost:** $0.0000

## Assessment

> Deterministic run. This exercises the harness, not a model, and cannot say whether the skill helps.

Run with `EVAL_BASELINE=1` for the paired comparison.

