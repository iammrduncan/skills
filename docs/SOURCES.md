# Skill source record

Reviewed 2026-10-08. A reviewed revision records evidence, not a promise to mirror upstream behavior.
Preserve the license notices in adapted files when refreshing them.

| Skill | Source | Baseline and review |
| --- | --- | --- |
| `anti-slop` TypeScript rules | [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (MIT) | Original baseline `446268e5d15baa968eaec669ff65358d36ae6259`. Reviewed `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`. See the plugin-local source record for selective ports. |
| `anti-slop` prose review | Local model repository's `book-anti-slop-review` | Inspected local revision `17ad3bb50d556712bd6812a9460b15df33b5b019`. Adapted review concepts and scanner behaviors. Speaker names, book paths, and production gates are excluded; installed skills do not require that repository. |
| `engineering` questioning | [mattpocock/skills](https://github.com/mattpocock/skills), `skills/productivity/grilling` (MIT) | Original revision unknown. Reviewed question-convention change `95249b0b49782349740fd9b8c6ce32b4e59e497a`. |
| `engineering` ladder | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT) | Original revision unknown. Reviewed completeness rewrite `01cbf815429e89dcf37b7d2d2a8b593e886fcae1` and marker change `2a1fe842d078cf66ec7f3e6096a8ca4279c2cad7`. |
| `engineering` instruction layout | Local fxClaw `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, and internal style rationale | Short entry point, detailed conventions, delegating agent file. Adapt principles to target evidence rather than importing Zig policies. |
| `show-me` | [humanlayer/skills](https://github.com/humanlayer/skills) (MIT) | Body matches `6ab9013a` (2026-08-13). Reviewed `bba9d13ab34f0a87f1cc33df4dd196372393ddfc`. Local implicit invocation is retained deliberately; upstream now disables it. |
| `wait-what` | [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) | Original revision unknown. Reviewed glossary change `d80fa0f4ebe0c5714af0adf8670336065233ecc6`. Local lookup supports existing context or glossary names. |
| `write-docs` | [Diátaxis](https://diataxis.fr/) | Reviewed source revision `957c09ca40b4a1edc23874f713e01937d50d54d5`; original snapshot unknown. Framework ideas are the reference. [Source license](https://github.com/evildmp/diataxis-documentation-framework/blob/957c09ca40b4a1edc23874f713e01937d50d54d5/LICENSE.rst) is CC BY-SA 4.0; assess copied expression before adding source text. |
| `write-adrs` | [Michael Nygard, Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions), 2011-11-15 | Five-part format. Original snapshot unknown; no behavioral refresh established. Article waives copyright and related rights. |
| `simplified-technical-english` | [ASD-STE100](https://www.asd-ste100.org/STE_faq.html) | Issue 9, 2025-01-15. Official FAQ still lists Issue 9; current PDF bytes were not retrieved. The skill notice records the local extraction and limits; redistribution permission remains an evidence gap before expanding extracted content. |

Selected TigerStyle resource/invariant concepts now inform both Good Engineering copies and manual
engineering/anti-slop review. TigerStyle is not an automatic policy for every project. Its reviewed file revision
is `ba8d4b347cbb29057fd52243d2909b7a830f9336` (2026-07-16), Apache-2.0. Consult current source and
handle attribution and modifications when copying text. Do not impose its allocation or size rules
without evidence that they fit the target.

For future refreshes, record the source path, inspected revision, relevant differences, intentional
local behavior, and tests. An unknown baseline must remain unknown until recovered from evidence.

## Notes-list review

The original [X post](https://x.com/juampitech/status/2090834948332655011) could not be retrieved.
Its candidate list was recovered from a
[cached repost](https://bittide.aicompass.dev/article/d3cc04c2-e2ed-437c-bdd7-fc2d45cc2bef); the following primary repository files were
then inspected directly on 2026-10-08. This records source review, not execution of external tools.

| Candidate and inspected repository revision | Decision |
| --- | --- |
| [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` | Already selectively adapted; see the plugin-local vendoring record. |
| [Cursor thermonuclear review](https://github.com/cursor/plugins/blob/ccb5507cec1546dc88135c1139c811e6c59115ba/thermos/skills/thermo-nuclear-code-quality-review/SKILL.md) | Adapted contextual inspection of branching, wrappers, canonical helpers and partial updates. Existing local file-size policy remains authoritative; no 1000-line mandate or automatic restructuring. |
| [Brian Lovin deslop](https://github.com/brianlovin/agent-config/blob/1a9819ebf3fee811150fc76cbe177ea4e5f747ff/skills/deslop/SKILL.md) | Diff-local comments and redundant guards inform manual review. Our command stays read-only. |
| [Cursor deslop](https://github.com/cursor/plugins/blob/ccb5507cec1546dc88135c1139c811e6c59115ba/cursor-team-kit/skills/deslop/SKILL.md) | Substantially overlapping rubric, not independent validation. Preserve rationale and runtime boundary checks. |
| [Claude Code Templates deslop](https://github.com/davila7/claude-code-templates/blob/46b4d8b1c051e9fd0f8fdd739b15f7f5e8942608/cli-tool/components/skills/sentry/deslop/SKILL.md) | Same core rubric plus Python import advice. No universal import relocation or automatic cleanup adopted. |
| [Desloppify](https://github.com/peteromallet/desloppify/blob/3a7735d531a96b6a226bfbdc9fd662b14195f857/desloppify/data/global/SKILL.md) | Useful separation of mechanical findings from subjective judgement and verified fixes. No score-target workflow, dependency, installation, commit or publishing behavior imported. |
| [AsyrafHussin code-slop](https://github.com/AsyrafHussin/agent-skills/blob/1aa0ff717c10309226c9e678f00873976450fd76/skills/code-slop/SKILL.md) and `rules/defensive-impossible-null.md` | Contextual comments, abstractions and test-quality checks are useful. Reject authorship inference, missing-HACK suspicion, formatting drift requirements, unverified statistics and blanket name/interface bans. TypeScript annotations and non-null assertions do not prove runtime input validity. |

The added procedures use original wording and do not vendor these candidate skills or their code.
Existing license notices and attribution remain intact. No candidate's popularity or score establishes
precision; these additions are manual judgement, with their limits stated in the code playbook.
