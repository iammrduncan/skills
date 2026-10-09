# `prose` — evidence and publication review

Read-only. Report findings; write no files. Requires Node.js 18 or newer, standard library only.
Keep cwd at the user's project. If Node or a shipped script/data file is absent, report the gap;
do not install a replacement or substitute a manual scan for the tool result.

```bash
node <skill-dir>/scripts/prose_lint.mjs docs/*.md
node <skill-dir>/scripts/prose_lint.mjs --json --fail-on warning README.md
node <skill-dir>/scripts/prose_lint.mjs --self-test
```

## Machine pass

Run the checker, then read every hit in context. Exit 1 means findings reached the selected
threshold; exit 2 means execution or configuration failed. Neither is a clean result.
JSON findings include a `pattern` identity for phrase, residue, rhythm and local-policy hits.
Multiple patterns in one sentence report separately. Locations are one-based.

| Rule | Severity | Meaning |
| --- | --- | --- |
| `no-unsupported-claim` | warning | Artifact subject, assertion verb and quality attribute without a number, evidence token or referent |
| `no-time-estimate` | error | Work-completion cue and a predicted duration; observed durations and cache TTLs are allowed |
| `no-empty-metaphor` | warning | Image replacing a mechanism; guards preserve technical seams and actual load-bearing walls |
| `no-ai-tell` | info | Phrase construction to inspect, including trailing commentary, nominalization stacks, stacked hedges and negative parallelism |
| `no-publication-residue` | error | Citation-tool handles, bracketed placeholders, URL tracking parameters and invisible characters |
| `review-paragraph-rhythm` | info | Repetition to inspect; thresholds below are review prompts |

Evidence and phrase checks blank code, link targets, comments and table rows. Quoted phrases
are mentions, so phrase checks skip them. Publication residue uses the original bytes, including
URL targets, inline/fenced code, comments and tables. Inspect the reported context before proposing
removal: a literal example or citation-handle diagnostic is allowed; analytics/campaign discussion
can need tracking parameters. Unicode joiners in Arabic, Devanagari or emoji sequences, and explicit
Unicode/line-break discussion, are allowed. These contextual exceptions are heuristics: read the
source when an exception appears to hide residue. A clean scan does not establish completeness.

The sentence patterns permit explicit technical contexts, such as conserving momentum, ensuring
exclusive access under a mutex, and a contrast supported by a truth table. A guard only finds a
context cue; it does not establish that the sentence is useful.

## Paragraph pass

The defaults preserve the inspected scanner's thresholds:

- Three consecutive sentences of at most four words; colon-led labels are excluded.
- At least three comma-separated series of three in one paragraph.
- At least three consecutive paragraphs with the same first word; articles are excluded.
- At least three sections at heading levels one or two ending with the same first two words
  of their final sentence; colon-led labels are excluded.
- Adjacent paragraph/list pairs with at least six content words in each and overlap of at least
  60% of the smaller set. Stop words are excluded.

Code and table content do not count as paragraphs. Lists do not count as short-sentence runs.
Repeated instructions, checklists, procedural labels and technical enumerations can be useful.
Explain whether each hit adds information or merely repeats it. Never gate publication on an
advisory hit count or call rhythm a quality score.

## Local owner policy

Read applicable project instructions and prose notes. Use a policy only when the owner selects it;
no policy is discovered automatically, and the portable defaults do not ban owner vocabulary.

```bash
node <skill-dir>/scripts/prose_lint.mjs --policy /project/prose-policy.json README.md
node <skill-dir>/scripts/prose_lint.mjs --self-test --policy /project/prose-policy.json
```

[owner-prose-policy.json](owner-prose-policy.json) is an optional example based on owner notes.
It rejects em dashes in all contexts and advises on “genuinely,” figurative “shape,” “pedigree” and
“fail closed.” Shape has tensor/dimension/geometry/array exceptions; fail-closed authentication
and authorization retain their technical meaning. Existing seam/load-bearing guards remain in
the portable metaphor check. Inspect density and referents when judging overuse; a vocabulary
hit is not proof that a passage is wrong.

Policy JSON requires `patterns`. Entries use the [pattern fields](adding-rules.md), plus
`scope` (`prose`, the default, or `raw`) and `severity` (`info`, the default, `warning`, or `error`).
Each needs a firing example; add passing examples for legitimate uses. Invalid scope/severity,
missing policy arguments, unreadable files and malformed JSON are execution errors, exit 2.
Raw scope intentionally includes quotations and code. Never silently alter quoted evidence.

## Manual evidence pass

Read the complete target after running the checker. For each consequential claim:

1. Open its cited source and locate the passage, table or result supporting that exact claim.
   Check scope, date, population, units and uncertainty. A URL or digit satisfies a machine cue;
   it does not verify support. If the source is unavailable, report it as unverified.
2. Separate observed results from calculated estimates and publisher-reported results. Record
   assumptions and arithmetic for calculations; attribute external measurements to their source.
3. Run runnable examples in their declared environment. Resolve imports and paths; compare actual
   stdout, errors and numeric output with the document. Record command, revision and environment.
   Mark excerpts/pseudocode and report missing requirements instead of claiming execution.
4. Derive test expectations independently from a specification, hand calculation or independent
   reference. Do not copy implementation output into expected values. Where useful, deliberately
   break behavior in an isolated copy and confirm the test fails, then discard that mutation.

Report machine findings, manual findings and unchecked work separately, with locations and evidence.
Offer revisions after the report; `prose` itself stays read-only. No result identifies an author or
establishes that the document teaches, that a citation is true, or that every defect was found.

## Evidence and limits

The original claim-only calibration covered 32,483 repository words, three probe claims and one
architecture example. It does not measure the added sentence, residue or paragraph checks.
Current fixtures establish individual pattern identity, thresholds, positions and selected legitimate
uses. They do not establish precision or recall over a representative corpus.

The added concepts were inspected in the owner's model repository skill `book-anti-slop-review`
on 2026-10-08, local revision `17ad3bb50d556712bd6812a9460b15df33b5b019`: its rules page,
scanner, scanner tests and manual review procedure. The JavaScript implementation is independent;
Python-only flags, chapter templates, speaker policies, lesson paths and missing-scanner skips
were not imported. No standalone license was found in that inspected repository. This installed
skill has no dependency on that repository or its paths.
