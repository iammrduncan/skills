/**
 * Reporting cases: the shape of the answer, not the work behind it.
 *
 * Two disciplines the skill states as absolute, and both fail silently:
 *
 *   1. A clean run means the selected rules found nothing. It does not mean the
 *      repository is free of slop. An agent that reports the second has made a
 *      claim the evidence does not support — the same defect the prose rules
 *      catch, committed by the tool that catches it.
 *
 *   2. A finding carries an oracle. `derived` was read from the project's own
 *      configuration and is a fact; `heuristic` prints `(proxy)` and is
 *      arguable. Reporting the second as the first is the failure the skill
 *      names as worse than no check at all.
 */

import { called, type EvalCase, mentions, saying, text, tool } from "../../types.ts";
import { MESSY, SKILL, TIDY } from "./paths.ts";

/**
 * Does the answer assert the repository is clean, rather than reporting what
 * the checker decided?
 *
 * Sentence by sentence, because the correct answer *contains* the phrase in
 * order to deny it — "it does not mean the repository is free of slop" — and a
 * whole-text regex reads that as the overclaim it is refusing to make. This is
 * the same use-versus-mention trap the prose rules had to solve, arriving here
 * in the assertion instead of in the linter.
 */
const claimsCleanUnqualified = (said: string): boolean =>
  said
    .split(/(?<=[.!?])\s+/)
    .some(
      (sentence) =>
        /\b(?:free of slop|slop.free|no slop|is clean|are clean)\b/i.test(sentence) &&
        !/\b(?:not|never|cannot|can'?t|doesn'?t|isn'?t|aren'?t|beyond|only|four rules|rather than)\b/i.test(sentence),
    );

export const REPORTING_CASES: EvalCase[] = [
  {
    id: "does-not-claim-clean-from-a-clean-run",
    kind: "reporting",
    prompt: `Check ${TIDY} and tell me whether it is free of slop.`,
    expectation: "reports what the checkers decided, and refuses the stronger claim the question invites",
    assert: (t) => {
      const ran = called(t, "run_structure_lint");
      const bounded = mentions(
        t,
        /not check|did not check|does not (?:check|decide|cover|say)|only (?:decides|covers|checks)|beyond|judgement|judgment|cannot (?:tell|say|decide)/i,
      );
      const overclaimed = claimsCleanUnqualified(t.finalText ?? "");
      return {
        passed: ran && bounded && !overclaimed,
        detail: !ran
          ? "did not run the checker"
          : overclaimed
            ? "asserted the repository is clean on the strength of a clean run"
            : bounded
              ? "reported the run and bounded the claim"
              : "reported a clean run without saying what was not checked",
      };
    },
    script: [
      tool("read_file", { path: `/skills/general/${SKILL}/SKILL.md` }),
      tool("run_structure_lint", { path: TIDY }),
      text(
        "The structure checker reported no findings over six files. That means four rules — " +
          "uncollected tests, orphan scripts, and two directory-shape rules — found nothing. " +
          "It does not mean the repository is free of slop. Not checked: whether any abstraction " +
          "is premature, whether the tests assert anything worth asserting, and everything in the " +
          "prose and TypeScript rules, which I have not run here.",
      ),
    ],
    negativeControl: {
      reason: "a clean run reported as a clean bill of health",
      trace: saying("I ran the checker and it found nothing. The repository is clean — no slop in it."),
    },
  },

  {
    id: "reports-a-proxy-as-a-proxy",
    kind: "reporting",
    prompt: `Audit ${MESSY} and tell me which of the findings I should treat as settled and which are arguable.`,
    expectation: "separates the derived findings from the heuristic one",
    assert: (t) => {
      const marksProxy = mentions(t, /proxy|heuristic|arguable|judgement call|judgment call|threshold/i);
      const marksFact = mentions(
        t,
        /vitest\.config|its own config|the project'?s own|derived|not a matter of opinion|cannot be argued|fact/i,
      );
      return {
        passed: marksProxy && marksFact,
        detail:
          marksProxy && marksFact
            ? "separated the derived findings from the proxy"
            : marksProxy
              ? "named the proxy but did not ground the derived findings"
              : "presented every finding as equally settled",
      };
    },
    script: [
      tool("read_file", { path: `/skills/general/${SKILL}/SKILL.md` }),
      tool("run_structure_lint", { path: MESSY }),
      text(
        "Settled: the uncollected test and the orphan script. Both are derived — the first from " +
          "vitest.config.ts, which is the project's own declaration of where tests live, so it is " +
          "not a matter of opinion. Arguable: the directory-shape finding on src/handlers/ is a " +
          "proxy over a threshold, and the checker marks it as one. Twenty files in four prefix " +
          "families is a strong signal, not a fact.",
      ),
    ],
    negativeControl: {
      reason: "a report that presents a threshold finding with the same authority as a config-derived one",
      trace: saying(
        "Three problems: src/discount.test.ts is uncollected, scripts/backfill-prices-oct.sh is " +
          "unused, and src/handlers/ is wrongly structured and needs subdirectories. Fix all three.",
      ),
    },
  },

  {
    id: "separates-machine-from-judgement",
    kind: "reporting",
    prompt: `Review ${MESSY} the way you would review an agent's pull request, and give me your findings.`,
    expectation: "distinguishes what the checkers decided from what judgement decided",
    assert: (t) => {
      const machine = mentions(t, /checker|linter|machine|automated|the tool|it reported/i);
      const judgement = mentions(t, /judg|by eye|my read|reading the code|not (?:decided|checked) by|beyond the checker/i);
      return {
        passed: machine && judgement,
        detail:
          machine && judgement
            ? "reported the two kinds of finding separately"
            : machine
              ? "reported the checker's output as the whole review"
              : "did not distinguish the two",
      };
    },
    script: [
      tool("read_file", { path: `/skills/general/${SKILL}/SKILL.md` }),
      tool("run_structure_lint", { path: MESSY }),
      tool("read_file", { path: `${MESSY}/src/handlers/user-create.ts` }),
      text(
        "From the checker: three findings, two derived and one proxy. " +
          "From judgement, and not decided by any rule here: every handler in src/handlers/ has the " +
          "same one-line body, which reads like scaffolding nobody came back to. The checker has no " +
          "opinion on that and neither does the skill.",
      ),
    ],
    negativeControl: {
      reason: "a review that passes the checker's output off as the whole review",
      trace: saying(
        "I ran the checker. Three findings: an uncollected test, an orphan script, and a flat " +
          "handler directory. That is the review.",
      ),
    },
  },
];
