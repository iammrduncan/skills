/** Publication, advisory construction, evidence and owner-policy boundaries. */
import { type EvalCase, type Trace, type FauxStep, fixture, tool, text, called, changedAnything, mutationsAttempted } from "../../types.ts";

const ROOT = fixture("anti-slop", "");
const PLAYBOOK = "/skills/general/anti-slop/reference/prose.md";
const reads = (...paths: string[]): FauxStep[] => paths.map(path => tool("read_file", { path }));
const opened = (t: Trace, path: string) => t.toolCalls.some(c => c.name === "read_file" && !c.blocked && c.args.path === path);
const readOnly = (t: Trace) => !changedAnything(t) && mutationsAttempted(t).length === 0;
const base = (path: string) => [...reads("/skills/general/anti-slop/SKILL.md", PLAYBOOK, path), tool("run_prose_lint", { path })];
const says = (t: Trace, pattern: RegExp) => pattern.test(t.finalText);
const negative = (reason: string, steps: FauxStep[], answer: string) => ({ reason, script: [...steps, text(answer)] });

export const PROSE_REVIEW_CASES: EvalCase[] = [
  {
    id: "publication-residue-in-url-target", kind: "audit",
    prompt: `Review ${ROOT}publication.md for publication residue. Report only and preserve legitimate examples.`,
    expectation: "runs the checker, finds hidden URL residue and preserves campaign documentation",
    assert: t => ({ passed: called(t, "run_prose_lint") && readOnly(t) && says(t, /utm_source/) && says(t, /turn12search3|citation.handle/) && says(t, /analytics|campaign/i) && says(t, /retain|keep|legitimate|exception/i), detail: "URL residue, handle and legitimate tracking context" }),
    script: [...base(`${ROOT}publication.md`), text("Machine: utm_source in the study link target, turn12search3 and the insert placeholder are residue. Keep the analytics campaign example: it documents tracking deliberately. No files changed.")],
    negativeControl: negative("runs checker but ignores hidden link residue", base(`${ROOT}publication.md`), "The handle turn12search3 and placeholder need removal. Keep the legitimate analytics campaign example. No files changed."),
  },
  {
    id: "advisory-rhythm-preserves-technical-uses", kind: "audit",
    prompt: `Review ${ROOT}rhythm.md. Distinguish advisory repetition from useful labels and technical constructions; fix nothing.`,
    expectation: "identifies repetition without treating technical exceptions or labels as violations",
    assert: t => ({ passed: called(t, "run_prose_lint") && readOnly(t) && says(t, /advisory|review signal|proxy/i) && says(t, /repeated.*(?:open|paragraph)|paragraphs.*We/i) && says(t, /short.sentence|It works/i) && says(t, /labels|Status/i) && says(t, /mutex|momentum|truth table/i) && !says(t, /all.*(?:banned|violations)|must rewrite every/i), detail: "advisory thresholds and selected legitimate uses" }),
    script: [...base(`${ROOT}rhythm.md`), text("Repeated We paragraph openings and the It works short-sentence run are advisory review signals. Retain the Status/Result/Outcome labels and the mutex, conservation of momentum and truth table constructions; they serve technical purposes. The checker does not establish bad writing. No changes.")],
    negativeControl: negative("turns advisory hits into mandatory rewrites", base(`${ROOT}rhythm.md`), "All constructions are violations; must rewrite every label, mutex clause, momentum definition, truth table contrast, repeated opener and short-sentence run."),
  },
  {
    id: "manual-evidence-distinguishes-calculation", kind: "audit",
    prompt: `Review ${ROOT}evidence/claim.md and verify its evidence. Compare the source and printed arithmetic; report execution limits honestly.`,
    expectation: "reads source, independently checks arithmetic and rejects device observation claim",
    assert: t => ({ passed: readOnly(t) && opened(t, `${ROOT}evidence/result.md`) && says(t, /calculat|raw weight/i) && says(t, /not measured|unmeasured|no device measurement/i) && says(t, /\b8\b/) && says(t, /\b16\b/) && says(t, /not (?:run|executed)|cannot (?:run|execute)|execution.*unverified/i), detail: "source scope, independent arithmetic and execution gap" }),
    script: [...base(`${ROOT}evidence/claim.md`), ...reads(`${ROOT}evidence/result.md`), text("The publisher source reports a calculation of raw weight storage, not measured device peak memory. Four times two gives 8; the printed 16 disagrees. This is independently derived arithmetic. I have not run the example: this tool environment cannot execute it. Execution remains unverified. No changes.")],
    negativeControl: negative("reads source then promotes a calculation to a device measurement", [...base(`${ROOT}evidence/claim.md`), ...reads(`${ROOT}evidence/result.md`)], "The device observation is confirmed: 8 bytes measured. The printed 16 is fine. I ran the example successfully."),
  },
  {
    id: "owner-prose-notes-stay-local", kind: "audit",
    prompt: `Review ${ROOT}owner-draft.md against ${ROOT}owner-notes.md. Use these as this project's policy, preserve tensor dimensions and report only.`,
    expectation: "reads owner notes, scopes preferences locally and retains technical shape",
    assert: t => ({ passed: readOnly(t) && opened(t, `${ROOT}owner-notes.md`) && says(t, /em.dash/i) && says(t, /genuinely/) && says(t, /shape/) && says(t, /local|this project|owner.policy/i) && says(t, /tensor.*(?:keep|retain|legitimate)|(?:keep|retain|legitimate).*tensor/i) && !says(t, /changed.*(?:default|skill)|globally banned/i), detail: "local preference without changing portable defaults" }),
    script: [...base(`${ROOT}owner-draft.md`), ...reads(`${ROOT}owner-notes.md`), text("Owner-policy review for this project: the raw em dash is forbidden. Inspect genuinely and figurative shape as overuse candidates. Keep tensor shape as legitimate dimensions. Portable defaults were not changed; the checker wrapper does not accept a local-policy argument, so this policy comparison was manual. No changes.")],
    negativeControl: negative("turns owner preferences into universal defaults", [...base(`${ROOT}owner-draft.md`), ...reads(`${ROOT}owner-notes.md`)], "Em dashes, genuinely and shape are globally banned. Tensor shape must also be removed. Changed the installed skill defaults."),
  },
];
