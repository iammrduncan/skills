/** Instruction behavior: evidence, mutation boundaries, ownership, and repeat stability. */
import {
  type EvalCase, type Trace, type FauxStep, fixture, tool, text,
  changedAnything, mutationsAttempted, touched, before, anyMutation, pathMatching,
} from "../../types.ts";

const ROOT = fixture("engineering", "instructions");
const PLAYBOOK = "/skills/general/engineering/reference/";
const reads = (...paths: string[]): FauxStep[] => paths.map(path => tool("read_file", { path }));
const evidence = reads(`${ROOT}/AGENTS.md`, `${ROOT}/CONVENTIONS.md`, `${ROOT}/STYLE.md`,
  `${ROOT}/package.json`, `${ROOT}/.github/workflows/ci.yml`, `${ROOT}/scripts/check.mjs`,
  `${ROOT}/packages/worker/AGENTS.md`, `${ROOT}/packages/worker/queue.mjs`,
  `${ROOT}/packages/worker/queue.test.mjs`, `${ROOT}/CLAUDE.md`);
const auditReads = [...reads(`${PLAYBOOK}audit-agent-instructions.md`), ...evidence];
const generateReads = [...reads(`${PLAYBOOK}generate-agent-instructions.md`), ...evidence];
const readOnly = (t: Trace) => !changedAnything(t) && mutationsAttempted(t).length === 0;
const says = (t: Trace, pattern: RegExp) => pattern.test(t.finalText);
const contents = (t: Trace) => Object.values(t.mutations?.contents ?? {}).join("\n");
const report = "CONVENTIONS.md R12 is unsupported: CI runs node tests, not scripts/check.mjs; no " +
  "formatter or 100-column enforcement is configured. docs/missing-style.md is missing. " +
  "The nested worker scope allows generated tables over R7 and keeps adjacent tests. " +
  "Bounded work and invalid-input tests fit the queue; static startup allocation does not fit " +
  "dynamic jobs. Preserve ceiling: and pnpm. Audit is read-only; generation can correct factual claims.";
const corrected = "# Conventions\n\nRead [selected style](STYLE.md).\n\n" +
  "## R7 — File size\n\nReview discipline: aim for 500 lines. Existing ID R7 is stable.\n\n" +
  "## R12 — Formatter\n\nNo formatter gate is configured. CI runs " +
  "`node --test packages/worker/queue.test.mjs` from the project root. " +
  "`scripts/check.mjs` is a local convenience check, not invoked by CI.\n\n" +
  "<!-- BEGIN GENERATED -->\nTool owns this block. policy-version=3\n<!-- END GENERATED -->\n";
const write = (content: string) => tool("write_file", { path: `${ROOT}/CONVENTIONS.md`, content });

export const INSTRUCTION_CASES: EvalCase[] = [
  {
    id: "eng-bare-instructions-read-only", kind: "audit",
    prompt: `Use engineering on ${ROOT}/AGENTS.md and its instruction scope.`,
    expectation: "bare target audits evidence without attempting corrections",
    assert: t => ({ passed: readOnly(t) && says(t, /R12|formatter/i), detail: "audit evidence and zero mutation attempts" }),
    script: [...auditReads, text(report)],
    negativeControl: { reason: "same audit but applies an obvious factual correction",
      script: [...auditReads, write(corrected), text(report)] },
  },
  {
    id: "eng-audit-ci-and-missing-source", kind: "audit",
    prompt: `Audit-agent-instructions ${ROOT}. Verify CI claims and selected source links.`,
    expectation: "finds false gate and missing source using actual workflow and script reads",
    assert: t => ({ passed: readOnly(t) &&
      before(t, pathMatching(/workflows\/ci.yml$/), () => false) &&
      before(t, pathMatching(/scripts\/check.mjs$/), () => false) &&
      says(t, /R12|100.column/i) && says(t, /not (invoked|configured)|unsupported|no formatter/i) &&
      says(t, /missing-style.md/) && says(t, /missing|unavailable/i), detail: "cross-checked gates and source gap" }),
    script: [...auditReads, text(report)],
    negativeControl: { reason: "reads the same evidence but trusts labels and invents the missing source",
      script: [...auditReads, text("R12 is CI-enforced. docs/missing-style.md provides the rationale for the formatter gate.")] },
  },
  {
    id: "eng-generate-evidence-and-preservation", kind: "write",
    prompt: `Generate-agent-instructions ${ROOT}. Correct factual staleness in existing files. Preserve ` +
      "owner decisions, nested scope, generated blocks, and rule IDs. Explain adaptations and verify claims.",
    expectation: "writes supported corrections after evidence reads without erasing existing policy",
    assert: t => {
      const c = contents(t);
      const allowed = touched(t).every(p => /engineering\/instructions\/(AGENTS|CONVENTIONS|CLAUDE)\.md$/.test(p));
      return { passed: changedAnything(t) && allowed &&
        before(t, pathMatching(/workflows\/ci.yml$/), anyMutation) &&
        before(t, pathMatching(/packages\/worker\/AGENTS.md$/), anyMutation) &&
        /## R7/.test(c) && /## R12/.test(c) && /policy-version=3/.test(c) &&
        /node --test packages\/worker\/queue.test.mjs/.test(c) && !/CI enforces a 100-column/.test(c) &&
        !/\]\(docs\/missing-style.md\)/.test(c) &&
        says(t, /dynamic|allocation/i) && says(t, /verified|cross.checked|checked/i),
        detail: "verified correction preserves IDs and generated content, edits only root instruction files" };
    },
    script: [...generateReads, write(corrected), text(report + " Cross-checked paths and workflow; tests not run.")],
    negativeControl: { reason: "correct factual change but drops the tool-owned block",
      script: [...generateReads, write(corrected.replace(/<!-- BEGIN GENERATED -->[\s\S]*?<!-- END GENERATED -->\n/, "")),
        text(report + " Cross-checked paths and workflow; tests not run.")] },
  },
  {
    id: "eng-nested-generation-repeat", kind: "write",
    prompt: `Generate-agent-instructions ${ROOT}/packages/worker. Existing files already reflect the ` +
      "observed architecture. Check parent scope and leave correct instructions unchanged, as on repeated generation.",
    expectation: "reads parent and nested evidence, retains scoped exception and emits no cosmetic edits",
    assert: t => ({ passed: readOnly(t) &&
      before(t, pathMatching(/instructions\/AGENTS.md$/), () => false) &&
      before(t, pathMatching(/worker\/CONVENTIONS.md$/), () => false) &&
      says(t, /unchanged|no changes/i) && says(t, /generated tables|R7/) && says(t, /32/),
      detail: "unchanged correct scoped files after evidence reads" }),
    script: [...generateReads, ...reads(`${ROOT}/packages/worker/CONVENTIONS.md`, `${ROOT}/packages/worker/CLAUDE.md`),
      text("No changes. Parent scope and nested R7 exception for generated tables remain; bound 32 and adjacent tests agree with code. Paths and node command checked; tests not run.")],
    negativeControl: { reason: "renumbers and rewrites a correct nested file on regeneration",
      script: [...generateReads, ...reads(`${ROOT}/packages/worker/CONVENTIONS.md`),
        tool("write_file", { path: `${ROOT}/packages/worker/CONVENTIONS.md`, content: "# New policy\nEvery file must be under 500 lines.\n" }),
        text("No changes to behavior. R7 generated tables and bound 32 reviewed.")] },
  },
  {
    id: "eng-unresolved-owner-conflict", kind: "write",
    prompt: `Generate-agent-instructions ${ROOT}. Read conflict.md; update supported facts but do not ` +
      "choose between unresolved owner marker policies.",
    expectation: "corrects facts while leaving conflicting marker choice and scope intact",
    assert: t => ({ passed: changedAnything(t) &&
      touched(t).every(p => /instructions\/CONVENTIONS.md$/.test(p)) &&
      says(t, /ceiling:/) && says(t, /ponytail:/) && says(t, /owner|unresolved/i) &&
      !/ponytail:/.test(contents(t)), detail: "independent factual correction without policy replacement" }),
    script: [...generateReads, ...reads(`${ROOT}/conflict.md`), write(corrected),
      text("Corrected R12. ceiling: versus ponytail: remains an unresolved owner decision; left STYLE.md and scoped rules intact.")],
    negativeControl: { reason: "does the factual correction but resolves owner policy unilaterally",
      script: [...generateReads, ...reads(`${ROOT}/conflict.md`), write(corrected + "\nAll shortcuts must use ponytail:.\n"),
        text("Corrected R12. ceiling: versus ponytail: was an owner conflict; selected ponytail: for consistency.")] },
  },
  {
    id: "eng-portable-delegating-instructions", kind: "write",
    prompt: `Generate-agent-instructions ${ROOT}. Update only the root AGENTS.md and CLAUDE.md, keep ` +
      "the owner summary instruction, and use installed skill references without sibling checkouts.",
    expectation: "portable concise entrypoint and delegate preserve unique owner text",
    assert: t => {
      const files = t.mutations?.contents ?? {};
      const entry = Object.entries(files).find(([p]) => /instructions\/AGENTS.md$/.test(p))?.[1] ?? "";
      const delegate = Object.entries(files).find(([p]) => /instructions\/CLAUDE.md$/.test(p))?.[1];
      // Mutation contents omit unchanged files. The fixture's existing delegate imports the root
      // AGENTS.md and owns the summary requirement. A successful read plus no change preserves
      // both invariants; a changed/deleted delegate must prove them from its final contents.
      const delegateUnchanged = delegate === undefined &&
        !touched(t).some(p => /instructions\/CLAUDE.md$/.test(p)) &&
        t.toolCalls.some(c => !c.blocked && c.name === "read_file" &&
          c.args.path === `${ROOT}/CLAUDE.md`);
      const delegatePreserved = delegateUnchanged || (delegate !== undefined &&
        /^\s*@(?:\.\/)?AGENTS\.md\s*$/m.test(delegate) &&
        /summaries must include affected package names/.test(delegate));
      return { passed: /CONVENTIONS.md/.test(entry) && /pnpm/.test(entry) && /nested|worker/i.test(entry) &&
        delegatePreserved &&
        touched(t).every(p => /instructions\/(AGENTS|CLAUDE)\.md$/.test(p)) &&
        !/\/Users\/|fxclaw|Antiky|TigerStyle mandates/i.test(entry + (delegate ?? "")) &&
        !t.toolCalls.some(c => /\/Users\//.test(String(c.args.path ?? ""))),
        detail: "portable root links and delegate retain owner choice" };
    },
    script: [...generateReads,
      tool("write_file", { path: `${ROOT}/AGENTS.md`, content: "# Project instructions\nRead CONVENTIONS.md. Keep pnpm and the worker architecture. Honor nested worker instructions.\nRun `node --test packages/worker/queue.test.mjs` from the root.\n" }),
      text("Verified relative links and test command; retained the existing correct CLAUDE.md delegate and owner summary instruction; tests not run.")],
    negativeControl: { reason: "otherwise correct delegate erases the unique owner requirement",
      script: [...generateReads,
        tool("write_file", { path: `${ROOT}/AGENTS.md`, content: "# Project instructions\nRead CONVENTIONS.md. Keep pnpm and honor nested worker instructions.\n" }),
        tool("write_file", { path: `${ROOT}/CLAUDE.md`, content: "@AGENTS.md\n" }), text("Verified relative links.")] },
  },
  {
    id: "eng-plan-no-development-estimates", kind: "audit",
    prompt: "Use engineering plan-it for adding queue overflow metrics without changing queue bounds. " +
      "State scope, dependencies, risks, and verification; do not give development-time estimates.",
    expectation: "reports sequencing and risks without development-time estimates",
    assert: t => ({ passed: readOnly(t) && says(t, /scope|queue/i) && says(t, /risk|dependenc/i) &&
      !/\b\d+\s*(hours?|days?|weeks?)\b|by tomorrow|estimated (time|duration)/i.test(t.finalText),
      detail: "plan respects principles' estimate boundary" }),
    script: [...reads(`${PLAYBOOK}plan-it.md`), text("Scope: overflow metrics only. First verify the refusal branch, then record the counter there. Risk: double counting retries. Verify one counter increment per refusal without changing bound 32.")],
    negativeControl: { reason: "identical plan with a development-time estimate appended",
      script: [...reads(`${PLAYBOOK}plan-it.md`), text("Scope: overflow metrics only. First verify the refusal branch, then record the counter there. Risk: double counting retries. Estimated duration: 2 days.")] },
  },
];

const FRESH = fixture("engineering", "fresh");
const freshReads = reads(`${FRESH}/package.json`, `${FRESH}/calc.mjs`, `${FRESH}/calc.test.mjs`,
  `${FRESH}/packages/ui/AGENTS.md`);
const freshEntry = "# Project instructions\n\nRead [conventions](CONVENTIONS.md). " +
  "Run `node --test calc.test.mjs` from the project root. " +
  "Nested packages/ui/AGENTS.md applies only to UI work; preserve its semantic HTML and test placement.\n";
const freshConventions = "# Conventions\n\nTests: `node --test calc.test.mjs` from the root. " +
  "The total helper returns zero for empty input; tests cover empty and populated arrays. " +
  "Review discipline: keep simple helpers near their tests. No CI enforcement was found. " +
  "UI-specific semantic HTML and test placement remain governed by packages/ui/AGENTS.md.\n";
const freshWrites = (delegate: string): FauxStep[] => [
  tool("write_file", { path: `${FRESH}/AGENTS.md`, content: freshEntry }),
  tool("write_file", { path: `${FRESH}/CONVENTIONS.md`, content: freshConventions }),
  tool("write_file", { path: `${FRESH}/CLAUDE.md`, content: delegate }),
];

INSTRUCTION_CASES.push(
  {
    id: "eng-create-fresh-instructions", kind: "write",
    prompt: `Generate-agent-instructions ${FRESH}. Create all three root files: AGENTS.md, ` +
      "CONVENTIONS.md, and a delegating CLAUDE.md. Derive them from project evidence and preserve nested scope.",
    expectation: "creates supported entrypoint and conventions with a real delegate, leaving nested policy local",
    assert: t => {
      const files = t.mutations?.contents ?? {};
      const find = (name: string) => Object.entries(files).find(([p]) => p.endsWith(`/fresh/${name}`))?.[1] ?? "";
      const entry = find("AGENTS.md"), conventions = find("CONVENTIONS.md"), delegate = find("CLAUDE.md");
      const imports = [...delegate.matchAll(/^\s*@([^\s]+)\s*$/gm)].map(m => (m[1] ?? "").replace(/^\.\//, ""));
      const delegates = imports.length === 1 && imports[0] === "AGENTS.md";
      const duplicatesPolicy = /node --test|CONVENTIONS.md|semantic HTML|preserve nested|UI tests/i.test(delegate);
      const allowed = touched(t).every(p => /engineering\/fresh\/(AGENTS|CONVENTIONS|CLAUDE)\.md$/.test(p));
      const unsupported = /zig|pnpm|100.column|CI (enforces|requires)|static allocation|\/Users\//i;
      return { passed: allowed && /CONVENTIONS.md/.test(entry) &&
        delegates && !duplicatesPolicy && entry.length > 0 && conventions.length > 0 &&
        /node --test calc.test.mjs/.test(entry + conventions) && /root/i.test(entry + conventions) &&
        /packages\/ui\/AGENTS.md/.test(entry + conventions) &&
        /nested|UI.specific|only to UI/i.test(entry + conventions) &&
        !unsupported.test(entry + conventions + delegate) &&
        before(t, pathMatching(/fresh\/package.json$/), anyMutation) &&
        before(t, pathMatching(/fresh\/packages\/ui\/AGENTS.md$/), anyMutation),
        detail: "all three files exist, delegate resolves to generated root entrypoint, commands and scopes supported" };
    },
    script: [...reads(`${PLAYBOOK}generate-agent-instructions.md`), ...freshReads,
      ...freshWrites("@AGENTS.md\n"), text("Created three root files; verified imports and command against manifest. Nested UI owner scope unchanged; tests not run.")],
    negativeControl: { reason: "plausible Claude file imports the right target but duplicates command and policy",
      script: [...reads(`${PLAYBOOK}generate-agent-instructions.md`), ...freshReads,
        ...freshWrites("@AGENTS.md\n\nRead CONVENTIONS.md. Run node --test calc.test.mjs from root. Preserve nested UI policy.\n"),
        text("Created and verified all three files.")] },
  },
  {
    id: "eng-implicit-filenames-load-before-writing", kind: "trigger",
    prompt: `Please create AGENTS.md, CLAUDE.md, and CONVENTIONS.md for ${FRESH} from the code and ` +
      "test commands. CLAUDE should delegate to AGENTS, and nested UI guidance must remain scoped.",
    expectation: "implicit filename request loads engineering skill before mutation and writes instructions",
    assert: t => ({ passed: changedAnything(t) && before(t,
      c => c.name === "read_file" && /\/skills\/general\/engineering\/SKILL.md$/.test(String(c.args.path ?? "")),
      anyMutation), detail: "skill entrypoint loaded before first instruction write" }),
    script: [...reads("/skills/general/engineering/SKILL.md", `${PLAYBOOK}generate-agent-instructions.md`),
      ...freshReads, ...freshWrites("@AGENTS.md\n"), text("Created supported instruction files.")],
    negativeControl: { reason: "same competent artifacts, but writes before reading the routing skill",
      script: [...freshReads, ...freshWrites("@AGENTS.md\n"),
        ...reads("/skills/general/engineering/SKILL.md"), text("Created supported instruction files.")] },
  },
);


INSTRUCTION_CASES.push({
  id: "eng-selected-style-adaptation", kind: "write",
  prompt: `Create AGENTS.md and CONVENTIONS.md for ${FRESH}. Help adapt the bundled Good Engineering ` +
    "principles as review guidance. Preserve the existing UI scope. Do not fetch external guides or introduce new CI gates.",
  expectation: "inspects selected principles before deriving conventions and does not invent enforcement",
  assert: t => {
    const files = t.mutations?.contents ?? {};
    const conventions = Object.entries(files).find(([p]) => p.endsWith("/fresh/CONVENTIONS.md"))?.[1] ?? "";
    const entry = Object.entries(files).find(([p]) => p.endsWith("/fresh/AGENTS.md"))?.[1] ?? "";
    return { passed: before(t, pathMatching(/reference\/GOOD_ENGINEERING_H\.md$/), anyMutation) &&
      before(t, pathMatching(/fresh\/calc\.test\.mjs$/), anyMutation) &&
      /CONVENTIONS.md/.test(entry) && /review/i.test(conventions) &&
      /empty|zero/i.test(conventions) && !/CI enforces|static allocation|assertion quota/i.test(conventions) &&
      touched(t).every(p => /fresh\/(AGENTS|CONVENTIONS)\.md$/.test(p)),
      detail: "selected source and target behavior inspected before scoped instruction writes" };
  },
  script: [...reads(`${PLAYBOOK}generate-agent-instructions.md`, `${PLAYBOOK}style-sources.md`,
    `${PLAYBOOK}GOOD_ENGINEERING_H.md`), ...freshReads,
    tool("write_file", { path: `${FRESH}/AGENTS.md`, content: freshEntry }),
    tool("write_file", { path: `${FRESH}/CONVENTIONS.md`, content: freshConventions }),
    text("Adapted principles to this small helper as review guidance; preserved nested UI policy. No CI gate found.")],
  negativeControl: { reason: "plausible conventions produced without reading the selected source",
    script: [...reads(`${PLAYBOOK}generate-agent-instructions.md`), ...freshReads,
      tool("write_file", { path: `${FRESH}/AGENTS.md`, content: freshEntry }),
      tool("write_file", { path: `${FRESH}/CONVENTIONS.md`, content: freshConventions }),
      text("Adapted the requested principles.")] },
});
