/**
 * One evaluated agent run. THIS FILE ONLY EVER EXECUTES INSIDE THE CONTAINER.
 *
 * It reads a job on stdin, runs a pi agent against it with the read-only tool
 * surface, and writes one JSON trace to stdout. It writes nothing else and
 * touches no file outside the read-only mounts.
 *
 * Never invoke this from the host. `eval/run.ts` is the entry point; it spawns
 * this under podman. The guard at the bottom refuses to run outside a container.
 *
 * Targets @earendil-works/pi-ai 0.84.x, where providers are registered
 * explicitly rather than read from a bundled catalog. Model definitions are
 * pinned here on purpose: the eval must not depend on a network catalog fetch.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import {
  createModels,
  fauxProvider,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import type { Model } from "@earendil-works/pi-ai";
import { buildTools, type RecordedCall } from "./tools.ts";
import { loadCatalog, SKILL_INSTRUCTIONS } from "./skills.ts";
import { seedWorkspace, collectMutations, releaseWorkspace, WORKSPACE, type Mutations } from "./workspace.ts";
import type { FauxStep } from "../suites/types.ts";

/** pi's reasoning levels, lowest to highest. */
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

interface Job {
  prompt: string;
  provider: "openrouter" | "faux";
  modelId: string;
  systemPrompt: string;
  thinkingLevel: ThinkingLevel;
  /** False runs the baseline arm: no skill catalog in the system prompt. */
  withSkill: boolean;
  /** Scripted assistant turns, faux provider only. */
  fauxScript?: FauxStep[];
}

/** Token and cost totals for one run, summed across every assistant turn. */
export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  totalTokens: number;
  costUsd: number;
  turns: number;
}

export interface Trace {
  toolCalls: RecordedCall[];
  finalText: string;
  usage: UsageTotals;
  /** What the agent actually changed in /workspace. */
  mutations: Mutations;
  error?: string;
}

const emptyUsage = (): UsageTotals => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
  totalTokens: 0,
  costUsd: 0,
  turns: 0,
});

/**
 * Model definitions, pinned.
 *
 * Prices are $ per million tokens as published by OpenRouter. The model
 * supports tool calling, which the eval depends on.
 *
 * `thinkingLevelMap` maps pi's level onto what the provider actually accepts.
 * A `null` entry means "send no reasoning parameter at this level" — that is
 * how deepseek's own catalog entry treats its lower levels, so it is kept here.
 */
const MODELS: Record<string, Model<"openai-completions">> = {
  // A dated snapshot, not the rolling `deepseek-v4-flash` alias: an alias can be
  // repointed under a pinned eval, which would silently change what a release
  // measured. Routing is left to OpenRouter, so the endpoint — and therefore the
  // exact price — varies between $0.072 and $0.130 per M input. The shim records
  // which provider actually served each call; see the `served_by` log events.
  "deepseek/deepseek-v4-flash-0731": {
    id: "deepseek/deepseek-v4-flash-0731",
    name: "DeepSeek V4 Flash (0731)",
    api: "openai-completions",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: true,
    compat: { requiresReasoningContentOnAssistantMessages: true, thinkingFormat: "deepseek" },
    thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high", xhigh: "max" },
    input: ["text"],
    cost: { input: 0.08, output: 0.18, cacheRead: 0.016, cacheWrite: 0 },
    contextWindow: 1_048_576,
    maxTokens: 8192,
  } as unknown as Model<"openai-completions">,
};

/** How many times a 429 is waited out before the request is allowed to fail. */
const RATE_LIMIT_RETRIES = 6;

/** Same line shape as the per-run logger, usable from module scope. */
const logEvent = (record: Record<string, unknown>) => {
  if (process.env.EVAL_LOG === "1") {
    process.stderr.write(JSON.stringify({ t: Date.now(), ...record }) + "\n");
  }
};

/**
 * What OpenRouter actually charged, summed over the run's requests.
 *
 * pi derives cost from the price table on the Model definition, and every one of
 * those declares `cacheRead: 0`. On a cache-heavy run that is not a rounding
 * error: one prior run billed 144M cache-read tokens, and the harness
 * reported $0.69 for what the account was charged roughly $8.50 for. The figure
 * matched `input × price + output × price` to the cent, which is how the cause
 * was found — it was our arithmetic, faithfully executed, on a table that priced
 * the largest column at zero.
 *
 * So the cost is no longer computed. OpenRouter returns what it charged when the
 * request asks for it, and that number is authoritative: it cannot drift when a
 * provider changes pricing, and it already accounts for cache tiers and
 * per-endpoint rates.
 */
interface RequestContext {
  billed: { costUsd: number; requests: number };
  onServed: (provider: string) => void;
  disableReasoning: boolean;
}

/** Keeps concurrent jobs' routing, logs, and billed cost separate. */
const requestContext = new AsyncLocalStorage<RequestContext>();

/** Whether the wrapper is already in place. See installOpenRouterShim. */
let shimInstalled = false;

function installOpenRouterShim(): void {
  // Install exactly once per process.
  //
  // This used to reassign globalThis.fetch on every call, which was harmless
  // when a container held one job and is not now: twelve concurrent agents meant
  // twelve nested wrappers, every response unwinding through all of them. The
  // visible cost was arithmetic — each layer added the charged amount to
  // every job, so a run reported many times what it spent.
  if (shimInstalled) return;
  shimInstalled = true;

  const original = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? "");
    const isCompletion = url.includes("openrouter.ai") && url.includes("/chat/completions");
    const context = requestContext.getStore();

    if (init?.body && isCompletion) {
      try {
        const body = JSON.parse(String(init.body));
        // Ask for the charged amount. Without this the response carries token
        // counts but no cost, and the only figure available is one we computed.
        body.usage = { include: true };
        if (context?.disableReasoning) {
          // pi has no "off" in its thinkingLevelMap, so an off setting sends no
          // reasoning parameter at all — and a model that reasons by default
          // just keeps reasoning. DeepSeek V4 Flash 0731 emitted 292k reasoning
          // tokens in a run labelled off until this was added.
          // OpenRouter's own switch is the only thing that actually stops it.
          body.reasoning = { enabled: false };
          delete body.reasoning_effort;
        }
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Not a JSON body we understand. Leave it exactly as it was.
      }
    }

    // OpenRouter rate-limits by request, not by spend, and the limit is small:
    // a 429 carries `x-ratelimit-limit: 10` with `remaining: 0`. A paired run is
    // several hundred requests, so without backoff a run walks straight into the
    // wall — and pi surfaces the rejection as an empty turn, which reads like an
    // agent that answered briefly and stopped. That is how v0.3.0 shipped a
    // headline computed over 131 refused requests.
    //
    // Honour the reset header when it is present, since it is exact, and fall
    // back to exponential backoff when it is not.
    let response = await original(input, init);
    for (let attempt = 0; response.status === 429 && attempt < RATE_LIMIT_RETRIES; attempt++) {
      const resetAt = Number(response.headers.get("x-ratelimit-reset") ?? 0);
      const fromHeader = resetAt > 0 ? resetAt - Date.now() : 0;
      const backoff = 1000 * 2 ** attempt;
      const waitMs = Math.min(Math.max(fromHeader, backoff), 30_000);
      logEvent({ ev: "rate_limited", attempt: attempt + 1, waitMs });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      response = await original(input, init);
    }

    // Record the endpoint that actually served the call. With unpinned routing
    // the price varies by endpoint, so the reported cost is only checkable if we
    // know who answered. Reads a clone so the real stream is untouched.
    if (isCompletion && response.ok) {
      try {
        const text = await response.clone().text();
        const match = /"provider"\s*:\s*"([^"]+)"/.exec(text);
        if (match?.[1]) context?.onServed(match[1]);

        // The charged amount, straight from the response. Matched loosely
        // because the field sits inside `usage` on a completion and inside the
        // final SSE frame on a stream, and both shapes are worth catching.
        const charged = /"cost"\s*:\s*([0-9.eE+-]+)/.exec(text);
        if (charged?.[1]) {
          const value = Number(charged[1]);
          if (Number.isFinite(value) && context) {
            context.billed.costUsd += value;
            context.billed.requests += 1;
          }
        }
      } catch {
        // Cost and endpoint logging are diagnostics. Do not discard a valid
        // model response because its clone could not be inspected.
      }
    }
    return response;
  };
}

/**
 * Turn declarative steps into faux assistant turns.
 *
 * Each tool step is its own assistant message, because the agent loop needs a
 * turn boundary to execute the call and feed the result back. A text step ends
 * the run.
 */
function scriptToResponses(steps: FauxStep[]) {
  return steps.map((step) =>
    step.kind === "tool"
      ? fauxAssistantMessage([fauxToolCall(step.name, step.args as never)], { stopReason: "toolUse" })
      : fauxAssistantMessage([fauxText(step.text)], { stopReason: "stop" }),
  );
}

/** Keep only the message roles an LLM understands. */
function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter((m: any) => ["user", "assistant", "toolResult"].includes(m.role)) as Message[];
}

/**
 * Many jobs in one container.
 *
 * A container per case cost one Node process and one SDK load each — about
 * 1.3s, which was never the problem, and 512 MB of budget, which was: the
 * concurrency ceiling was arithmetic on VM memory rather than anything the work
 * required. Several agents in one process share the runtime and the SDK, so the
 * marginal cost of another concurrent agent is its conversation, not another
 * interpreter.
 *
 * Each job still gets its own seeded copy of the fixtures under its own root.
 * That is the part a shared process gives away for free and has to earn back:
 * two cases from one suite running at once would otherwise see each other's
 * writes, and mutation assertions are what several suites turn on.
 *
 * Traces stream out as NDJSON keyed by index, so the orchestrator can record a
 * result the moment it lands rather than waiting for the slowest job.
 */
interface Batch {
  jobs: Job[];
  concurrency?: number;
}

export async function runBatch(batch: Batch): Promise<void> {
  const limit = Math.max(1, batch.concurrency ?? 1);
  let next = 0;

  const worker = async (slot: number): Promise<void> => {
    const root = `${WORKSPACE}/w${slot}`;
    while (true) {
      const index = next++;
      if (index >= batch.jobs.length) return;
      const job = batch.jobs[index]!;
      let trace: Trace;
      try {
        trace = await runJob(job, root, index);
      } catch (error) {
        // One job's crash must not take the batch down with it — that is the
        // isolation a container-per-case used to provide for free.
        trace = {
          toolCalls: [],
          finalText: "",
          usage: emptyUsage(),
          mutations: { created: [], modified: [], deleted: [], contents: {} },
          error: String(error),
        };
      } finally {
        releaseWorkspace(root);
      }
      process.stdout.write(JSON.stringify({ index, trace }) + "\n");
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, batch.jobs.length) }, (_, i) => worker(i)));
}

export async function runJob(job: Job, workspaceRoot: string = WORKSPACE, tag?: number): Promise<Trace> {
  const toolCalls: RecordedCall[] = [];
  const record = (call: RecordedCall) => toolCalls.push(call);
  const usage = emptyUsage();
  let liveContext: RequestContext | undefined;

  // The agent works on a copy. /suites stays pristine so the run can be diffed.
  // With several agents in one container each gets its own copy; the tool layer
  // maps the agent-visible /workspace onto it, so nothing else has to know.
  seedWorkspace(workspaceRoot);

  // Every agent event, as JSONL on stderr. The orchestrator streams this to the
  // run directory and can tail it live. stdout stays clean for the trace.
  const logEvents = process.env.EVAL_LOG === "1";
  // `job` tags the line with its index so the orchestrator can split one
  // container's interleaved stderr back into per-case logs. Absent on the
  // single-job path, where there is nothing to disentangle.
  const logLine = (record: Record<string, unknown>) => {
    if (logEvents) {
      process.stderr.write(JSON.stringify({ t: Date.now(), ...(tag === undefined ? {} : { job: tag }), ...record }) + "\n");
    }
  };

  const models = createModels();
  let model: Model<any>;

  if (job.provider === "faux") {
    const faux = fauxProvider({ tokensPerSecond: 0 });
    models.setProvider(faux.provider);
    faux.setResponses(scriptToResponses(job.fauxScript ?? [{ kind: "text", text: "(no script)" }]));
    model = faux.getModel();
  } else {
    models.setProvider(openrouterProvider());
    const pinned = MODELS[job.modelId];
    if (!pinned) {
      throw new Error(`unknown model: ${job.modelId}. Known: ${Object.keys(MODELS).join(", ")}`);
    }
    model = pinned;

    // Always installed: even unrouted models need the served-by record, because
    // an unpinned endpoint is exactly the case where the price is unknown.
    const off = job.thinkingLevel === "off";
    const seen = new Set<string>();
    installOpenRouterShim();
    liveContext = {
      billed: { costUsd: 0, requests: 0 },
      onServed: (provider) => {
        if (seen.has(provider)) return;
        seen.add(provider);
        logLine({ ev: "served_by", model: job.modelId, provider });
      },
      disableReasoning: off,
    };
    logLine({
      ev: "provider_routing",
      model: job.modelId,
      routing: "standard",
      reasoning: off ? "disabled" : job.thinkingLevel,
    });
  }

  // Discovery through pi's own loader, against the skills baked into the image.
  // The baseline arm loads nothing, so its prompt carries no catalog.
  let promptText = job.systemPrompt;
  if (job.withSkill) {
    const catalog = await loadCatalog("/skills");
    for (const d of catalog.diagnostics) {
      logLine({ ev: "skill_diagnostic", code: d.code, message: d.message, path: d.path });
    }
    logLine({ ev: "skills_loaded", count: catalog.skills.length, names: catalog.skills.map((s) => s.name) });
    if (catalog.catalogXml) {
      promptText = `${job.systemPrompt}\n\n${SKILL_INSTRUCTIONS}\n\n${catalog.catalogXml}`;
    }
  }

  logLine({ ev: "run_start", provider: job.provider, model: job.modelId, withSkill: job.withSkill, thinking: job.thinkingLevel });

  const agent = new Agent({
    initialState: {
      systemPrompt: promptText,
      model,
      // Both arms get the identical tool surface. The only difference is
      // whether the system prompt carries the skill catalog — which is exactly
      // the difference a real deployment has, since activation is a file read.
      tools: buildTools(record, job.withSkill, workspaceRoot),
      messages: [],
      thinkingLevel: job.thinkingLevel,
    },
    streamFn: (m, context, options) => models.streamSimple(m, context, options),
    convertToLlm,
    getApiKey: (provider) =>
      provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined,
    // Mutating tools run for real inside /workspace. The tools themselves refuse
    // a path outside it, so nothing here needs to block — and a case can assert
    // on the resulting files instead of on the agent's prose.
  });

  const chunks: string[] = [];
  /** Assistant turns the provider returned with no tokens at all. See below. */
  let emptyTurns = 0;
  agent.subscribe((event: any) => {
    switch (event.type) {
      case "tool_execution_start":
        logLine({ ev: "tool_start", tool: event.toolName, args: event.args });
        break;
      case "tool_execution_end":
        logLine({ ev: "tool_end", tool: event.toolName, isError: event.isError ?? false });
        break;
      case "turn_start":
        logLine({ ev: "turn_start" });
        break;
      case "agent_end":
        logLine({ ev: "agent_end" });
        break;
    }

    if (event.type !== "message_end" || event.message?.role !== "assistant") return;

    for (const block of event.message.content ?? []) {
      if (block?.type === "text" && block.text) chunks.push(block.text);
    }

    // Usage is per assistant turn. A tool-using run has several, so they sum.
    const u = event.message.usage;
    if (u) {
      // A turn that consumed nothing and produced nothing is the provider
      // declining to answer — a 429, a truncation, an empty completion. pi ends
      // the run cleanly and the trace looks like a well-behaved agent that
      // simply stopped early, so the case fails on its own assertion and the
      // report blames the skill.
      //
      // This shipped a release. A throttled burst produced 131 empty final turns
      // out of 134 runs and the headline read "7/67 with the skills, 5/67
      // without" — a plausible number that measured nothing but rate limiting.
      // Count them so the run can refuse to be reported.
      if (!u.input && !u.output && !u.cacheRead && !u.cacheWrite) emptyTurns += 1;
      usage.input += u.input ?? 0;
      usage.output += u.output ?? 0;
      usage.cacheRead += u.cacheRead ?? 0;
      usage.cacheWrite += u.cacheWrite ?? 0;
      usage.reasoning += u.reasoning ?? 0;
      usage.totalTokens += u.totalTokens ?? 0;
      usage.costUsd += u.cost?.total ?? 0;
      usage.turns += 1;
      logLine({
        ev: "usage",
        input: u.input, output: u.output,
        cacheRead: u.cacheRead, cacheWrite: u.cacheWrite,
        reasoning: u.reasoning, cost: u.cost?.total,
      });
    }
  });

  /**
   * Replace the computed cost with what the provider charged.
   *
   * Only when at least one request reported one — a faux run bills nothing and
   * must stay at zero rather than inherit a stale figure. `usage.costUsd` is
   * otherwise pi's arithmetic over our price table, which zeroes cache reads.
   */
  const settle = (): typeof usage => {
    const billed = liveContext?.billed;
    if (billed && billed.requests > 0) {
      logLine({ ev: "billed", requests: billed.requests, costUsd: billed.costUsd, computed: usage.costUsd });
      // On a metered provider the charged amount is the honest figure for both.
      return { ...usage, costUsd: billed.costUsd };
    }
    return usage;
  };

  try {
    if (liveContext) {
      await requestContext.run(liveContext, async () => await agent.prompt(job.prompt));
    } else {
      await agent.prompt(job.prompt);
    }
  } catch (error) {
    return { toolCalls, finalText: chunks.join("\n"), usage: settle(), mutations: collectMutations(workspaceRoot), error: String(error) };
  }
  if (emptyTurns > 0 && !chunks.length) {
    // No text at all and at least one refused turn: the model never answered.
    // An error here is honest — the alternative is a verdict about a skill,
    // derived from a response that was never produced.
    return {
      toolCalls,
      finalText: "",
      usage: settle(),
      mutations: collectMutations(workspaceRoot),
      error: `provider returned ${emptyTurns} empty turn(s) and no text — throttled or truncated, not a skill result`,
    };
  }
  return { toolCalls, finalText: chunks.join("\n"), usage: settle(), mutations: collectMutations(workspaceRoot) };
}

function inContainer(): boolean {
  if (process.env.EVAL_IN_SANDBOX === "1") return true;
  // podman and docker each leave one of these behind.
  return fs.existsSync("/run/.containerenv") || fs.existsSync("/.dockerenv");
}

if (
  process.argv[1] &&
  fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])
) {
  if (!inContainer()) {
    process.stderr.write(
      "agent-run.ts refuses to run outside a container.\n" +
        "The pi SDK has no permission model; this harness relies on the container\n" +
        "as its only real boundary. Use `npm run test:skill-behavior` instead.\n",
    );
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(0, "utf-8")) as Job | Batch;
  if ("jobs" in input) {
    runBatch(input).catch((error) => {
      process.stderr.write(`batch failed: ${String(error)}\n`);
      process.exitCode = 1;
    });
  } else {
    runJob(input)
      .then((trace) => process.stdout.write(JSON.stringify(trace) + "\n"))
      .catch((error) => {
        process.stdout.write(
          JSON.stringify({ toolCalls: [], finalText: "", error: String(error) }) + "\n",
        );
        process.exitCode = 1;
      });
  }
}
