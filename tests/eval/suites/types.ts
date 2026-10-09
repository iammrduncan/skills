/**
 * Shared vocabulary for eval cases.
 *
 * A case bundles four things that belong together and used to live in three
 * separate files: the prompt, the assertion, the scripted turns that should
 * satisfy it, and a negative control proving the assertion can fail.
 *
 * `negativeControl` is REQUIRED. An assertion with no negative control is not a
 * test — it is a green light with no bulb. `self-test.ts` iterates every case
 * and fails the suite if any one of them accepts its own counter-example.
 */

/** A declarative agent turn. Crosses a process boundary as JSON, so no functions. */
export type FauxStep =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; args: Record<string, unknown> };

/** What the agent did, as observed by the sandbox run. */
export interface Trace {
  toolCalls: { name: string; args: Record<string, unknown>; blocked: boolean }[];
  finalText: string;
  /** What the agent changed in its workspace. */
  mutations?: {
    created: string[]; modified: string[]; deleted: string[];
    contents: Record<string, string>;
  };
  /** Token and cost totals, present on live runs. */
  usage?: {
    input: number; output: number; cacheRead: number; cacheWrite: number;
    reasoning: number; totalTokens: number; costUsd: number; turns: number;
  };
  error?: string;
}

export interface Verdict {
  passed: boolean;
  detail: string;
}

/**
 * A counter-example. Either a literal trace, or a script to actually run in the
 * container when the misbehavior involves the tool layer (a blocked edit, say)
 * and a hand-written trace would beg the question.
 */
export interface NegativeControl {
  /** Why this must fail. Shown in the self-test report. */
  reason: string;
  trace?: Trace;
  script?: FauxStep[];
  /** Prompt to use when `script` is set. Defaults to the case's own prompt. */
  prompt?: string;
}

export type CaseKind =
  | "trigger" | "audit" | "fix" | "reporting" | "write"
  | "patch" | "pr" | "update" | "classify" | "split";

/**
 * One suite per skill under test. The suite name IS the skill name, and matches a
 * directory under both cases/ and fixtures/ — so a skill, its cases, and its
 * fixtures are always found under the same name.
 */
export type Suite =
  | "simplified-technical-english"
  | "write-adrs"
  | "write-objectives"
  | "write-docs"
  | "engineering"
  | "show-me"
  | "anti-slop";

export interface EvalCase {
  id: string;
  /** Which skill's suite this belongs to. Set by the suite's index, not by hand. */
  suite?: Suite;
  kind: CaseKind;
  prompt: string;
  /** Human-readable statement of what must hold. */
  expectation: string;
  assert: (trace: Trace) => Verdict;
  /** Scripted turns that SHOULD satisfy `assert`. */
  script: FauxStep[];
  negativeControl: NegativeControl;
}

/** Stamp a suite onto its cases so reports and selectors can group them. */
export const inSuite = (suite: Suite, cases: EvalCase[]): EvalCase[] =>
  cases.map((c) => ({ ...c, suite }));

// --- assertion helpers -----------------------------------------------------

export const SKILL = "simplified-technical-english";

export const MUTATING = ["edit_file", "write_file", "move_file"] as const;

/** A tool that ran (was not blocked). */
export const called = (trace: Trace, name: string): boolean =>
  (trace.toolCalls ?? []).some((c) => c.name === name && !c.blocked);

/** A tool the agent tried to use, whether or not it was allowed. */
export const attempted = (trace: Trace, name: string): boolean =>
  (trace.toolCalls ?? []).some((c) => c.name === name);

/**
 * Did the agent activate the skill?
 *
 * pi has no activation tool: the model reads the SKILL.md at the location given
 * in the `<available_skills>` catalog. So activation is a read_file whose path
 * lands inside that skill's directory — which is a genuinely harder bar than
 * calling a tool named after the thing you want.
 */
export const skillInvoked = (trace: Trace, skill: string = SKILL): boolean =>
  (trace.toolCalls ?? []).some(
    (c) =>
      !c.blocked &&
      (c.name === "read_file" || c.name === "list_dir") &&
      new RegExp(`/skills/general/${skill}(/|$)`).test(String(c.args.path ?? "")),
  );

export const mentions = (trace: Trace, pattern: RegExp): boolean => pattern.test(trace.finalText ?? "");

// --- ordering ---------------------------------------------------------------

/**
 * Index of the first tool call matching `match`, or -1.
 *
 * A predicate rather than a name so a caller can ask about the arguments too —
 * "the first read under /skills/x" is a different question from "the first read".
 */
export const firstIndex = (trace: Trace, match: (call: Trace["toolCalls"][number]) => boolean): number =>
  (trace.toolCalls ?? []).findIndex((c) => !c.blocked && match(c));

/**
 * Did `first` happen before `second`?
 *
 * Set membership is the weaker question. "Read the area, then wrote the record"
 * and "wrote the record, then read the area" contain the same calls and are not
 * the same behaviour — the second one guessed and checked afterwards. Borrowed
 * from impeccable's `loadedBeforeImplementationWrite`, which is the assertion
 * that catches an agent doing the right reads for show.
 *
 * `false` when `first` never happened. `true` when `second` never happened:
 * the ordering constraint is vacuously satisfied, and "second never happened"
 * is a different assertion that should be written separately if it is meant.
 */
export const before = (
  trace: Trace,
  first: (call: Trace["toolCalls"][number]) => boolean,
  second: (call: Trace["toolCalls"][number]) => boolean,
): boolean => {
  const a = firstIndex(trace, first);
  if (a < 0) return false;
  const b = firstIndex(trace, second);
  return b < 0 || a < b;
};

/** Matcher: a read or list under this skill's directory. */
export const readOf = (skill: string) => (c: Trace["toolCalls"][number]) =>
  (c.name === "read_file" || c.name === "list_dir") &&
  new RegExp(`/skills/general/${skill}(/|$)`).test(String(c.args.path ?? ""));

/** Matcher: any call that changes the workspace. */
export const anyMutation = (c: Trace["toolCalls"][number]) =>
  (MUTATING as readonly string[]).includes(c.name);

/** Matcher: a read or list whose path matches. */
export const pathMatching = (pattern: RegExp) => (c: Trace["toolCalls"][number]) =>
  pattern.test(String(c.args.path ?? ""));

export const mutationsAttempted = (trace: Trace): string[] =>
  (trace.toolCalls ?? []).filter((c) => (MUTATING as readonly string[]).includes(c.name)).map((c) => c.name);

/** Compact tool trace for reports: `read_file → run_ste_lint`. */
export const toolPath = (trace: Trace): string =>
  (trace.toolCalls ?? []).map((c) => (c.blocked ? `${c.name}(BLOCKED)` : c.name)).join(" → ") || "none";

// --- mutation helpers ------------------------------------------------------

/** Files the agent created, relative to the workspace root. */
export const created = (trace: Trace): string[] => trace.mutations?.created ?? [];
export const modified = (trace: Trace): string[] => trace.mutations?.modified ?? [];
export const deleted = (trace: Trace): string[] => trace.mutations?.deleted ?? [];

/** Did the agent change anything at all? The read-only cases turn on this. */
export const changedAnything = (trace: Trace): boolean =>
  created(trace).length + modified(trace).length + deleted(trace).length > 0;

/** Every path the agent touched, for reporting a violation precisely. */
export const touched = (trace: Trace): string[] =>
  [...created(trace), ...modified(trace), ...deleted(trace)].sort();

/** A created file whose path matches, with its contents. */
export const createdMatching = (trace: Trace, pattern: RegExp): { path: string; content: string }[] =>
  created(trace)
    .filter((p) => pattern.test(p))
    .map((p) => ({ path: p, content: trace.mutations?.contents[p] ?? "" }));

// --- small builders --------------------------------------------------------

export const tool = (name: string, args: Record<string, unknown> = {}): FauxStep => ({
  kind: "tool",
  name,
  args,
});

export const text = (value: string): FauxStep => ({ kind: "text", text: value });

/** A trace with no tool calls and the given answer. For literal negative controls. */
export const saying = (finalText: string): Trace => ({ toolCalls: [], finalText });

/**
 * A near-miss control: competent work that cuts exactly one corner.
 *
 * The standard comes from ponytail's robustness audit, where every probe carries
 * a `bad` reference that "is correct on the happy path — it only cuts the corner
 * the issue is about". A control that is wrong in five ways cannot tell you
 * which of the five your assertion is keyed on.
 *
 * The failure mode this exists to fix: a trigger assertion is `skillInvoked`,
 * and a control built from `saying(...)` has no tool calls at all. It fails —
 * but so would a trace of the agent reading the weather. All that proves is that
 * the assertion is not `() => true`.
 *
 * So a near-miss runs a real script: the agent reads the real fixture, inspects
 * the real directory, and answers plausibly. It just never opens the skill. Now
 * the assertion has to separate "read the skill" from "read some files", which
 * is the thing it claims to measure.
 */
export const nearMiss = (reason: string, script: FauxStep[], prompt?: string): NegativeControl => ({
  reason,
  script,
  ...(prompt ? { prompt } : {}),
});

// --- skill names -----------------------------------------------------------

export const SKILLS = {
  ste: "simplified-technical-english",
  adr: "write-adrs",
  objectives: "write-objectives",
  writeDocs: "write-docs",
  engineering: "engineering",
  showMe: "show-me",
  antiSlop: "anti-slop",
} as const;

// --- fixture paths ---------------------------------------------------------

/**
 * A fixture path, as the agent sees it.
 *
 * Each suite's `fixtures/` is assembled into /workspace under the skill's own
 * name, so this addresses the writable copy the agent works on. The suites tree
 * itself is mounted read-only at /suites and the agent is not told about it.
 */
export const fixture = (suite: Suite, name: string): string => `/workspace/${suite}/${name}`;
