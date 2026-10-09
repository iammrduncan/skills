/**
 * Container plumbing, shared by the runner and the self-test.
 *
 * Everything that knows how to start a container lives here, so the security
 * posture is stated once. Neither caller ever runs the pi SDK in its own
 * process.
 *
 * Streams rather than blocks: the container's stderr carries the pi event log
 * line by line, which is written to the run directory and optionally tailed to
 * the console while the run is still going. stdout carries exactly one JSON
 * trace, so data and logs never interleave.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FauxStep, Trace } from "./suites/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..");
/**
 * The suites tree: one directory per skill, each with cases/ and fixtures/.
 * Mounted read-only in the container, which assembles /workspace from the
 * fixtures inside it — see sandbox/workspace.ts.
 */
export const SUITES = path.join(HERE, "suites");
export const RUNS_DIR = path.join(HERE, "runs");
export const IMAGE = "antiky-skills-eval";

/** pi's reasoning levels, lowest to highest. */
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

/**
 * Flags that make the container a boundary rather than a convenience.
 * Asserted empirically by self-test.ts — do not weaken without updating it.
 *
 * The memory cap is measured. Bisected against the heaviest *faux* path — two
 * run_ste_lint calls, each spawning a second node process that loads the 653 KB
 * vocabulary — a run needs 192m and fails at 128m.
 *
 * But a faux run is not the worst case. A live run carries the skill catalog, a
 * long tool history, and a dozen turns of context, and at 384m real runs were
 * OOM-killed (exit 137) once several ran concurrently. The cap is 768m: measured
 * floor times four, sized for the live path rather than the cheap one.
 *
 * This matters beyond tidiness: the cap bounds how many runs fit in the
 * container VM at once, so a generous one silently serialises the suite. The
 * original 1g was five times the real requirement and held concurrency at two.
 */
export const HARDENING = [
  "--read-only",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges",
  "--memory=768m",
  "--cpus=1",
  "--pids-limit=256",
  "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
  // The agent's writable scratch. Seeded from the read-only fixtures at start,
  // discarded with the container. Nothing on the host is reachable from it.
  "--tmpfs", "/workspace:rw,nosuid,size=64m",
];

/**
 * Reasoning effort for live runs, from EVAL_THINKING.
 *
 * `off` is enforced at the request level, not through pi's thinkingLevelMap.
 * See installOpenRouterShim in sandbox/agent-run.ts for why.
 */
export function thinkingLevel(): ThinkingLevel {
  const raw = (process.env.EVAL_THINKING ?? "off").trim().toLowerCase();
  if (!(THINKING_LEVELS as readonly string[]).includes(raw)) {
    process.stderr.write(
      `EVAL_THINKING="${raw}" is not valid. Use one of: ${THINKING_LEVELS.join(", ")}\n`,
    );
    process.exit(2);
  }
  return raw as ThinkingLevel;
}

export function detectRuntime(): string {
  for (const runtime of ["podman", "docker"]) {
    if (spawnSync(runtime, ["info"], { stdio: "ignore" }).status === 0) return runtime;
  }
  process.stderr.write(
    "\nNo container runtime is reachable.\n\n" +
      "This harness runs the pi agent SDK, which has no permission model of its\n" +
      "own. Its documentation is explicit that an in-process sandbox is not a\n" +
      "security boundary, so the SDK is never run on the host under any flag.\n\n" +
      "Start one and try again:\n" +
      "  podman machine start\n" +
      "  open -a Docker\n\n",
  );
  process.exit(2);
}

export function ensureImage(runtime: string, rebuild = false): void {
  const exists = spawnSync(runtime, ["image", "exists", IMAGE], { stdio: "ignore" });
  if (exists.status === 0 && !rebuild) return;
  process.stderr.write(`building ${IMAGE}...\n`);
  const build = spawnSync(
    runtime,
    ["build", "-t", IMAGE, "-f", path.join(HERE, "Dockerfile"), REPO_ROOT],
    { stdio: "inherit" },
  );
  if (build.status !== 0) {
    process.stderr.write("image build failed\n");
    process.exit(2);
  }
}

// --- run directory ---------------------------------------------------------

export interface RunLog {
  dir: string;
  id: string;
  /** Append a line to the orchestrator log, and echo it to the console. */
  note: (line: string) => void;
  /** Absolute path for a per-case log file. */
  casePath: (caseId: string, arm: string, ext: string) => string;
}

/**
 * Create `eval/runs/<id>/`, gitignored, holding every log and report for one
 * run. `EVAL_TAIL=1` additionally streams container stderr to the console as it
 * arrives.
 */
export function openRunLog(label: string, timestamp: string): RunLog {
  const id = `${timestamp}-${label}`;
  const dir = path.join(RUNS_DIR, id);
  fs.mkdirSync(path.join(dir, "cases"), { recursive: true });
  const logPath = path.join(dir, "run.log");

  return {
    dir,
    id,
    note: (line: string) => {
      fs.appendFileSync(logPath, line + "\n");
      process.stdout.write(line + "\n");
    },
    casePath: (caseId, arm, ext) => path.join(dir, "cases", `${caseId}.${arm}.${ext}`),
  };
}

// --- traces ----------------------------------------------------------------

/** A well-formed trace carrying only an error. */
const errorTrace = (error: string): Trace => ({ toolCalls: [], finalText: "", error });

/**
 * Force a parsed container response into the Trace shape.
 *
 * The container is supposed to print exactly one JSON trace on stdout, but a
 * crash mid-write, a stray log line, or a partial flush can leave the last line
 * parseable yet not a trace. Returning that raw would hand every downstream
 * consumer an object with no `toolCalls`, and one bad case would take out a
 * whole paid run. Normalising here means a malformed response fails its own
 * case and nothing else.
 */
function normalizeTrace(parsed: unknown, raw: string): Trace {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Trace).toolCalls)) {
    return errorTrace(`trace missing toolCalls: ${raw.slice(0, 200)}`);
  }
  const trace = parsed as Trace;
  return { ...trace, finalText: trace.finalText ?? "" };
}

// --- batched running -------------------------------------------------------

export interface BatchJob {
  /** Stable id used to name this job's log file. */
  id: string;
  prompt: string;
  systemPrompt: string;
  withSkill: boolean;
  script?: FauxStep[];
  shamSkillsDir?: string;
}

/**
 * Run many jobs inside **one** container.
 *
 * The old shape was one container per case: 134 of them for a paired suite. That
 * cost about 1.3s of startup each — which measurement showed was never the
 * bottleneck — and 512 MB of budget each, which was. Concurrency came out of
 * dividing VM memory by the size of a Node process, so it sat at 2 regardless of
 * what the work needed.
 *
 * Several agents in one process share the interpreter and the SDK, so the
 * ceiling becomes the provider's rate limit rather than our own arithmetic. Each
 * job still gets a freshly seeded workspace of its own inside the container.
 *
 * Jobs stream back as NDJSON `{index, trace}` as they finish, so a result is
 * recorded the moment it lands. Per-job stderr is demultiplexed by the `job`
 * field the container stamps on every log line.
 */
export async function runBatchInSandbox(
  runtime: string,
  options: {
    jobs: BatchJob[];
    provider: "faux" | "openrouter";
    modelId: string;
    thinkingLevel?: ThinkingLevel;
    concurrency: number;
    shamSkillsDir?: string;
    logFor?: (job: BatchJob, index: number) => string | undefined;
    onResult?: (index: number, trace: Trace) => void;
  },
): Promise<Trace[]> {
  const batch = {
    concurrency: options.concurrency,
    jobs: options.jobs.map((job) => ({
      prompt: job.prompt,
      provider: options.provider,
      modelId: options.modelId,
      systemPrompt: job.systemPrompt,
      thinkingLevel: options.thinkingLevel ?? thinkingLevel(),
      withSkill: job.withSkill,
      fauxScript: job.script,
    })),
  };

  const args = ["run", "--rm", "-i", ...batchHardening(options.concurrency),
                "-v", `${SUITES}:/suites:ro`, "-e", "EVAL_IN_SANDBOX=1", "-e", "EVAL_LOG=1"];
  if (options.shamSkillsDir) args.push("-v", `${options.shamSkillsDir}:/skills:ro`);
  applyProviderEnv(args, options.provider);
  args.push(IMAGE);

  const traces: Trace[] = new Array(options.jobs.length);
  const logs = options.jobs.map((job, index) => {
    const file = options.logFor?.(job, index);
    return file ? fs.createWriteStream(file, { flags: "a" }) : null;
  });

  return await new Promise<Trace[]>((resolve) => {
    const child = spawn(runtime, args, { stdio: ["pipe", "pipe", "pipe"] });
    let outBuf = "";
    let errBuf = "";

    child.stdout.on("data", (chunk) => {
      outBuf += chunk.toString();
      let nl: number;
      while ((nl = outBuf.indexOf("\n")) >= 0) {
        const line = outBuf.slice(0, nl).trim();
        outBuf = outBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const { index, trace } = JSON.parse(line) as { index: number; trace: unknown };
          const normalized = normalizeTrace(trace, line);
          traces[index] = normalized;
          options.onResult?.(index, normalized);
        } catch {
          /* a partial or non-JSON line: the missing trace is caught below */
        }
      }
    });

    // Route each log line to its own case file using the `job` tag. Untagged
    // lines (startup, crashes) go to every open log, because at that point there
    // is no way to know which job they belong to and losing them is worse.
    child.stderr.on("data", (chunk) => {
      errBuf += chunk.toString();
      let nl: number;
      while ((nl = errBuf.indexOf("\n")) >= 0) {
        const line = errBuf.slice(0, nl);
        errBuf = errBuf.slice(nl + 1);
        const tag = /"job"\s*:\s*(\d+)/.exec(line);
        if (tag) logs[Number(tag[1])]?.write(line + "\n");
        else for (const log of logs) log?.write(line + "\n");
        if (TAIL) process.stderr.write(line + "\n");
      }
    });

    child.on("close", (code) => {
      for (const log of logs) log?.end();
      for (let i = 0; i < traces.length; i++) {
        traces[i] ??= errorTrace(`container exited ${code} without returning a trace for job ${i}`);
      }
      resolve(traces);
    });

    child.stdin.write(JSON.stringify(batch));
    child.stdin.end();
  });
}

/**
 * Hardening for a batched container.
 *
 * Memory scales with the number of agents sharing the process rather than being
 * a flat per-container figure: one interpreter and one copy of the SDK, plus
 * each agent's conversation and its own seeded workspace copy.
 */
function batchHardening(concurrency: number): string[] {
  const base = 512;
  const perAgent = 192;
  const memMb = base + perAgent * concurrency;
  const tmpMb = 64 + 48 * concurrency;
  return HARDENING.map((flag) =>
    flag.startsWith("--memory=")
      ? `--memory=${memMb}m`
      : flag.startsWith("/workspace:")
        ? `/workspace:rw,nosuid,size=${tmpMb}m`
        : flag,
  );
}

/** Provider credentials and network posture, shared by both run paths. */
function applyProviderEnv(args: string[], provider: "faux" | "openrouter"): void {
  if (provider === "faux") {
    args.push("--network=none");
  } else {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      process.stderr.write("EVAL_PROVIDER=openrouter needs OPENROUTER_API_KEY in the environment.\n");
      process.exit(2);
    }
    args.push("-e", `OPENROUTER_API_KEY=${key}`);
  }
}

// --- running ---------------------------------------------------------------

export interface RunOptions {
  prompt: string;
  provider: "faux" | "openrouter";
  modelId: string;
  systemPrompt: string;
  thinkingLevel?: ThinkingLevel;
  /** False runs the baseline arm: no skills offered. Default true. */
  withSkill?: boolean;
  /**
   * Mount this tree over /skills instead of the baked-in one. The sham arm uses
   * it to present an identical catalog with generic bodies; see eval/sham.ts.
   */
  shamSkillsDir?: string;
  script?: FauxStep[];
  /** Where to write this run's container log. Omit to discard it. */
  logFile?: string;
}

const TAIL = process.env.EVAL_TAIL === "1";

/**
 * Run one agent job in a fresh container and return its trace.
 *
 * The container's stderr is streamed to `logFile` as it arrives, and mirrored to
 * the console when EVAL_TAIL=1, so a long live run is observable rather than
 * silent until it finishes.
 */
/**
 * Podman occasionally refuses a connection when many containers start at once
 * ("Cannot connect to Podman", exit 125). It is a race in the client, not a
 * statement about the run — and a self-test that reads it as a failed assertion
 * reports a broken harness when the harness is fine. Retry a few times.
 */
const TRANSIENT_START = /exited 125|Cannot connect to Podman/;

export async function runInSandbox(runtime: string, options: RunOptions): Promise<Trace> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const trace = await runInSandboxOnce(runtime, options);
    if (!trace.error || !TRANSIENT_START.test(trace.error)) return trace;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return await runInSandboxOnce(runtime, options);
}

async function runInSandboxOnce(runtime: string, options: RunOptions): Promise<Trace> {
  const job = {
    prompt: options.prompt,
    provider: options.provider,
    modelId: options.modelId,
    systemPrompt: options.systemPrompt,
    thinkingLevel: options.thinkingLevel ?? thinkingLevel(),
    withSkill: options.withSkill !== false,
    fauxScript: options.script,
  };

  const args = ["run", "--rm", "-i", ...HARDENING, "-v", `${SUITES}:/suites:ro`,
                "-e", "EVAL_IN_SANDBOX=1", "-e", "EVAL_LOG=1"];

  // Shadowing the baked-in /skills is what makes the sham arm a controlled
  // comparison: identical image, identical prompt, identical catalog, and the
  // only difference on disk is the body of each SKILL.md.
  if (options.shamSkillsDir) args.push("-v", `${options.shamSkillsDir}:/skills:ro`);

  applyProviderEnv(args, options.provider);
  args.push(IMAGE);

  const log = options.logFile ? fs.createWriteStream(options.logFile, { flags: "a" }) : null;
  const tailPrefix = options.logFile ? path.basename(options.logFile, ".log") : "";

  return await new Promise<Trace>((resolve) => {
    const child = spawn(runtime, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderrTail = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      log?.write(text);
      stderrTail = (stderrTail + text).slice(-2000);
      if (TAIL) {
        for (const line of text.split("\n")) {
          if (line.trim()) process.stdout.write(`      │ ${tailPrefix} ${line}\n`);
        }
      }
    });

    const finish = (status: number | null) => {
      log?.end();
      if (status !== 0 && !stdout.trim()) {
        resolve(errorTrace(`container exited ${status}: ${stderrTail.slice(-300)}`));
        return;
      }
      try {
        const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "{}";
        resolve(normalizeTrace(JSON.parse(line), stdout));
      } catch {
        resolve(errorTrace(`unparseable trace: ${stdout.slice(0, 200)}`));
      }
    };

    child.on("close", finish);
    child.on("error", (error) => {
      log?.end();
      resolve(errorTrace(String(error)));
    });

    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });
}

/** Run an arbitrary command in the image, for probing the sandbox itself. */
export function probe(runtime: string, command: string): { out: string; code: number } {
  const result = spawnSync(
    runtime,
    ["run", "--rm", "--network=none", ...HARDENING,
     "-v", `${SUITES}:/suites:ro`,
     "--entrypoint", "/bin/sh", IMAGE, "-c", command],
    { encoding: "utf-8", timeout: 60_000 },
  );
  return { out: (result.stdout ?? "") + (result.stderr ?? ""), code: result.status ?? -1 };
}

/**
 * The system prompt an evaluated agent gets.
 *
 * The baseline arm is identical except that it lists no skills and is not told
 * to load one — so a difference between the arms is attributable to the skill
 * rather than to a differently worded prompt.
 */
export function systemPrompt(withSkill = true): string {
  // This must match the tool surface in sandbox/tools.ts. It said the
  // environment was read-only for two releases after the writable workspace
  // landed, and agents believed it: they explained what they would write
  // instead of writing it, and every "created no file" failure was the harness
  // contradicting itself rather than the skill failing.
  const base = `You are a documentation engineer working in a repository.

The repository is at /workspace and you can read and write it: read_file, list_dir, write_file, edit_file, and move_file all work there. run_ste_lint runs the STE checker over a file. run_prose_lint and run_structure_lint run the anti-slop checkers over a file and over a repository root.

/skills is read-only — you can read a skill and its playbooks, but not change them. There is no shell.

When a task asks you to create or change something, do it. Do not describe the change you would make instead of making it.`;

  // The catalog is built inside the container by pi's own loadSkills(), so the
  // host never parses SKILL.md. The two arms differ only in whether that catalog
  // is offered — the prose above is byte-identical either way, which is what
  // makes a delta attributable to the skill rather than to the wording.
  void withSkill;
  return base;
}
