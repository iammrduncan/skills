/**
 * Harness self-test — the negative control for the skill-behavior eval.
 *
 * A green eval proves nothing on its own: assertions that can never fail are
 * also green. Every case declares a `negativeControl`, and this file feeds each
 * one to its own assertion and requires the assertion to REJECT it.
 *
 * Because it iterates the registry, a new case with a broken or missing
 * negative control fails the suite. That is the point: coverage is enforced
 * rather than remembered.
 *
 * It also probes the container itself, so the security posture is asserted
 * rather than assumed.
 *
 * If this file fails, no result from run.ts can be trusted.
 */

import { CASES, type EvalCase, type Trace } from "./suites/index.ts";
import { detectRuntime, ensureImage, probe, runInSandbox, systemPrompt } from "./container.ts";
import { concurrency, mapLimit } from "./pool.ts";

interface Check {
  group: string;
  name: string;
  detail: string;
  passed: boolean;
}

const checks: Check[] = [];
const check = (group: string, name: string, passed: boolean, detail: string) =>
  checks.push({ group, name, passed, detail });

const runtime = detectRuntime();
ensureImage(runtime, process.env.EVAL_REBUILD === "1");
const prompt = systemPrompt();

// --- 1. every assertion can fail -------------------------------------------
//
// This is the check that gives the suite meaning. For each case, obtain the
// counter-example trace — running it in the sandbox when the misbehavior
// involves the tool layer — and require assert() to reject it.

async function counterExample(testCase: EvalCase): Promise<Trace> {
  const control = testCase.negativeControl;
  if (control.trace) return control.trace;
  if (control.script) {
    return await runInSandbox(runtime, {
      prompt: control.prompt ?? testCase.prompt,
      provider: "faux",
      modelId: "faux-model",
      systemPrompt: prompt,
      script: control.script,
    });
  }
  return { toolCalls: [], finalText: "", error: "negative control declares neither trace nor script" };
}

// Counter-examples are independent: the ones with a script each need their own
// container, and running them one at a time dominated the self-test's runtime.
const verdicts = await mapLimit(CASES, concurrency(), async (testCase) => ({
  testCase,
  trace: await counterExample(testCase),
}));

for (const { testCase, trace } of verdicts) {
  if (trace.error) {
    check("assertions can fail", `${testCase.suite}/${testCase.id}`, false, `counter-example unusable: ${trace.error}`);
    continue;
  }
  const verdict = testCase.assert(trace);
  check(
    "assertions can fail",
    `${testCase.suite}/${testCase.id}`,
    !verdict.passed,
    verdict.passed
      ? `VACUOUS: accepted "${testCase.negativeControl.reason}"`
      : `rejects ${testCase.negativeControl.reason}`,
  );
}

// --- 2. a blocked mutation is still observable -----------------------------
//
// The ownership and read-only cases depend on an edit attempt appearing in the
// trace even though it never runs. Verify that directly.

const edited = await runInSandbox(runtime, {
  prompt: "Fix /workspace/simplified-technical-english/0001-example-decision_H.md and apply the corrections.",
  provider: "faux",
  modelId: "faux-model",
  systemPrompt: prompt,
  script: [
    { kind: "tool", name: "read_file", args: { path: "/skills/general/simplified-technical-english/SKILL.md" } },
    { kind: "tool", name: "edit_file", args: { path: "/workspace/simplified-technical-english/0001-example-decision_H.md", old_string: "utilize", new_string: "use" } },
    { kind: "text", text: "Applied the correction." },
  ],
});

const editedFiles = edited.mutations?.modified ?? [];
check(
  "tool layer",
  "a real edit lands on disk",
  editedFiles.some((p) => /0001-example-decision_H/.test(p)),
  editedFiles.length > 0
    ? `modified ${editedFiles.join(", ")}`
    : "the edit did not happen — behavioural assertions would silently pass",
);

// A write aimed outside /workspace must throw, so /skills and the pristine
// fixtures stay immutable even though the agent can now write.
const escape = await runInSandbox(runtime, {
  prompt: "Write to the skills tree.",
  provider: "faux",
  modelId: "faux-model",
  systemPrompt: prompt,
  script: [
    { kind: "tool", name: "write_file", args: { path: "/skills/general/write-adrs/SKILL.md", content: "x" } },
    { kind: "text", text: "done" },
  ],
});
check(
  "tool layer",
  "write outside /workspace is refused",
  (escape.mutations?.created.length ?? 0) === 0 && (escape.mutations?.modified.length ?? 0) === 0,
  "no mutation recorded outside the workspace",
);

// --- 3. the container confines the run -------------------------------------

const probes: [string, string, RegExp][] = [
  ["container filesystem is read-only", "echo x > /harness/pwned 2>&1 || echo BLOCKED", /BLOCKED|Read-only file system/i],
  ["suites mount is read-only", "echo x >> /suites/simplified-technical-english/fixtures/clean-procedure.md 2>&1 || echo BLOCKED", /BLOCKED|Read-only file system|No such file/i],
  ["faux runs have no network", "getent hosts openrouter.ai 2>&1 || echo NO_NETWORK", /NO_NETWORK/],
  ["runs as a non-root user", "id -un", /evaluator/],
  ["host filesystem is not visible", "ls /Users 2>&1 || echo NO_HOST_FS", /NO_HOST_FS|No such file/],
  ["skill tree is not writable", "echo x >> /skills/general/simplified-technical-english/SKILL.md 2>&1 || echo BLOCKED", /BLOCKED|Read-only file system|Permission denied/i],
];

for (const [name, command, expected] of probes) {
  const result = probe(runtime, command);
  check("sandbox", name, expected.test(result.out), result.out.trim().split("\n")[0]?.slice(0, 64) ?? "(no output)");
}

// --- 4. the SDK cannot run on the host -------------------------------------

const { spawnSync } = await import("node:child_process");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");
const here = path.dirname(fileURLToPath(import.meta.url));

const onHost = spawnSync(
  process.execPath,
  [path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs"), path.join(here, "sandbox", "agent-run.ts")],
  { input: "{}", encoding: "utf-8", timeout: 60_000, env: { ...process.env, EVAL_IN_SANDBOX: "" } },
);
check(
  "sandbox",
  "agent-run refuses to execute on the host",
  onHost.status === 2 && /refuses to run outside a container/.test(onHost.stderr ?? ""),
  `exit=${onHost.status}`,
);

// --- report ----------------------------------------------------------------

process.stdout.write(`\nharness self-test — runtime=${runtime}\n${"─".repeat(74)}\n`);
let group = "";
for (const c of checks) {
  if (c.group !== group) {
    group = c.group;
    process.stdout.write(`\n  ${group}\n`);
  }
  process.stdout.write(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name.padEnd(42)} ${c.detail}\n`);
}
const failed = checks.filter((c) => !c.passed);
process.stdout.write(`${"─".repeat(74)}\n${checks.length - failed.length}/${checks.length} passed\n`);
if (failed.length > 0) {
  process.stdout.write("\nThe eval harness cannot be trusted until these pass.\n");
}
process.exitCode = failed.length === 0 ? 0 : 1;
