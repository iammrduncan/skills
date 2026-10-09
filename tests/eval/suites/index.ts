/**
 * The eval suite registry.
 *
 * One directory per skill, holding everything that skill needs:
 *
 *   suites/<skill-name>/cases/     one file per concern, plus paths.ts
 *   suites/<skill-name>/fixtures/  the documents those cases work on
 *
 * Register a suite here and it joins every runner, the self-test included —
 * which fails the build if any case lacks a working negative control.
 */

import type { CaseKind, EvalCase, Suite } from "./types.ts";
import { ASDSTE100_CASES } from "./simplified-technical-english/cases/index.ts";
import { ADR_CASES } from "./write-adrs/cases/index.ts";
import { OBJECTIVES_CASES } from "./write-objectives/cases/index.ts";
import { GENERAL_WRITE_DOCS_CASES } from "./write-docs/cases/index.ts";
import { GENERAL_ENGINEERING_CASES } from "./engineering/cases/index.ts";
import { SHOW_ME_CASES } from "./show-me/cases/index.ts";
import { ANTI_SLOP_CASES } from "./anti-slop/cases/index.ts";

export * from "./types.ts";

export const SUITES = {
  "simplified-technical-english": ASDSTE100_CASES,
  "write-adrs": ADR_CASES,
  "write-objectives": OBJECTIVES_CASES,
  "write-docs": GENERAL_WRITE_DOCS_CASES,
  "engineering": GENERAL_ENGINEERING_CASES,
  "show-me": SHOW_ME_CASES,
  "anti-slop": ANTI_SLOP_CASES,
} satisfies Record<Suite, EvalCase[]>;

export const SUITE_NAMES = Object.keys(SUITES) as Suite[];

export const CASES: EvalCase[] = Object.values(SUITES).flat();

export const bySuite = (suite: Suite): EvalCase[] => SUITES[suite] ?? [];

export const byKind = (kind: CaseKind): EvalCase[] => CASES.filter((c) => c.kind === kind);

export const byId = (id: string): EvalCase | undefined => CASES.find((c) => c.id === id);

const KINDS: CaseKind[] = ["trigger", "audit", "fix", "reporting", "write", "patch", "pr", "update", "classify", "split"];

/**
 * Resolve an EVAL_ONLY selector, in order of specificity:
 *   a case id            → that case
 *   a suite name         → every case for that skill
 *   a kind               → that kind across all suites
 *   "suite:kind"         → one kind within one suite
 *   undefined            → everything
 */
export function select(selector?: string): EvalCase[] {
  if (!selector) return CASES;

  const single = byId(selector);
  if (single) return [single];

  if (selector in SUITES) return bySuite(selector as Suite);

  if (KINDS.includes(selector as CaseKind)) return byKind(selector as CaseKind);

  if (selector.includes(":")) {
    const [suite, kind] = selector.split(":", 2);
    if (suite && suite in SUITES && kind) {
      return bySuite(suite as Suite).filter((c) => c.kind === kind);
    }
  }
  return [];
}

/** Selector help, printed when EVAL_ONLY matches nothing. */
export const selectorHelp = (): string =>
  [
    "Valid EVAL_ONLY values:",
    `  suites: ${SUITE_NAMES.join(", ")}`,
    `  kinds:  ${[...new Set(CASES.map((c) => c.kind))].join(", ")}`,
    "  scoped: write-adrs:write",
    "  or any case id",
  ].join("\n");

// --- registry invariants ---------------------------------------------------

const seen = new Set<string>();
for (const testCase of CASES) {
  if (seen.has(testCase.id)) throw new Error(`duplicate eval case id: ${testCase.id}`);
  seen.add(testCase.id);
  if (!testCase.suite) throw new Error(`case ${testCase.id} has no suite; wrap it with inSuite()`);
}
