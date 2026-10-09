#!/usr/bin/env node
/**
 * Cut a release.
 *
 *   npm run release v0.2.0
 *   npm run release v0.2.0 -- --dry-run
 *   npm run release v0.2.0 -- --skip-eval        reuse the newest existing run
 *   npm run release v0.2.0 -- --no-push          commit and tag locally only
 *
 * Stages, in order. Each must pass before the next runs:
 *
 *   1. preflight   version format, clean tree, tag is free, CHANGELOG entry exists
 *   2. verify      typecheck, harness self-test, deterministic eval    (free)
 *   3. measure     paired live eval across every suite                 (costs money)
 *   4. report      write LATEST-EVAL-REPORT.md from that run
 *   5. commit      the report, and the version in package.json
 *   6. tag         annotated, carrying the eval headline
 *   7. push        main and the tag
 *
 * The self-test runs before the live eval on purpose: a green eval means nothing
 * if the assertions cannot fail, and there is no reason to pay for a measurement
 * that would not be trustworthy.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = path.join(ROOT, "tests");
const RUNS = path.join(TESTS, "eval", "runs");
const REPORT = path.join(ROOT, "LATEST-EVAL-REPORT.md");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");

// --- output ----------------------------------------------------------------

const bold = (s) => `[1m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;
let stage = 0;
const step = (title) => process.stdout.write(`\n${bold(`[${++stage}] ${title}`)}\n`);
const ok = (msg) => process.stdout.write(`    ✓ ${msg}\n`);
const info = (msg) => process.stdout.write(`    ${dim(msg)}\n`);
const die = (msg, fix) => {
  process.stderr.write(`\n    ✗ ${msg}\n`);
  if (fix) process.stderr.write(`\n${fix}\n`);
  process.stderr.write("\n");
  process.exit(1);
};

// --- shell -----------------------------------------------------------------

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf-8",
    env: process.env,
  });
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) process.stderr.write((result.stdout ?? "") + (result.stderr ?? ""));
    die(options.failure ?? `${command} ${args.join(" ")} failed`);
  }
  return result;
}

// --- arguments -------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const version = argv.find((a) => !a.startsWith("--"));

const DRY_RUN = flags.has("--dry-run");
const SKIP_EVAL = flags.has("--skip-eval");
const NO_PUSH = flags.has("--no-push");

for (const flag of flags) {
  if (!["--dry-run", "--skip-eval", "--no-push"].includes(flag)) {
    die(`unknown flag: ${flag}`, "  Valid flags: --dry-run  --skip-eval  --no-push");
  }
}

if (!version) {
  die(
    "no version given",
    "  Usage: npm run release v0.2.0\n" +
      "         npm run release v0.2.0 -- --dry-run",
  );
}
if (!/^v\d+\.\d+\.\d+$/.test(version)) {
  die(`"${version}" is not a version`, "  Expected the form v0.2.0");
}
const bare = version.slice(1);

process.stdout.write(
  `\n${bold(`Release ${version}`)}${DRY_RUN ? dim("  (dry run — nothing will be committed, tagged, or pushed)") : ""}\n`,
);

// --- 1. preflight ----------------------------------------------------------

step("Preflight");

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") {
  die(
    `on branch "${branch}", not main`,
    "  A release is cut from main. Merge your branch first:\n" +
      `    git checkout main && git merge --no-ff ${branch}`,
  );
}
ok("on main");

const dirty = git("status", "--porcelain");
if (dirty && !DRY_RUN) {
  die(
    "working tree is not clean",
    "  A release must be cut from a committed state, so the tag means something.\n" +
      "  Commit or stash first:\n\n" +
      dirty.split("\n").slice(0, 10).map((l) => `    ${l}`).join("\n"),
  );
}
ok(dirty ? "working tree dirty (allowed in a dry run)" : "working tree clean");

const tags = git("tag", "-l").split("\n").filter(Boolean);
if (tags.includes(version)) {
  die(`tag ${version} already exists`, `  Delete it first if you mean to recut:\n    git tag -d ${version}`);
}
ok(`tag ${version} is free`);

const changelog = fs.readFileSync(CHANGELOG, "utf-8");
if (!changelog.includes(`## [${bare}]`)) {
  die(
    `CHANGELOG.md has no "## [${bare}]" section`,
    "  Write the entry before cutting the release. The changelog is the human\n" +
      "  record; this script only measures and publishes.",
  );
}
ok(`CHANGELOG.md has a ${bare} entry`);

const behind = git("rev-list", "--count", `HEAD..origin/main`);
if (Number(behind) > 0) {
  die(`main is ${behind} commits behind origin/main`, "  Pull first:\n    git pull --ff-only");
}
ok("up to date with origin/main");

// --- 2. verify (free) ------------------------------------------------------

step("Verify — typecheck, unit tests, harness self-test, deterministic eval");
info("free; no model is called");

run("npm", ["run", "typecheck"], { cwd: TESTS, capture: true, failure: "typecheck failed" });
ok("typecheck clean");

run("npm", ["run", "test:unit"], { cwd: TESTS, capture: true, failure: "unit tests failed" });
ok("unit tests passed");

run("npm", ["run", "test:sandbox"], { cwd: TESTS, failure: "harness self-test failed — the eval cannot be trusted" });
ok("harness self-test passed");

run("npm", ["run", "test:skill-behavior"], { cwd: TESTS, failure: "deterministic eval failed" });
ok("deterministic eval passed");

// --- 3. measure (costs money) ----------------------------------------------

step("Measure — paired live eval");

let runId;
if (SKIP_EVAL) {
  // The newest run is not the newest *usable* one: stage 2 runs the
  // deterministic eval, which writes a faux run directory seconds before this
  // looks. Taking the newest by name always found that one and died on the faux
  // gate below, which made this flag impossible to use. Filter to runs that
  // could pass the gates.
  const existing = fs.existsSync(RUNS) ? fs.readdirSync(RUNS).sort() : [];
  const usable = existing.filter((d) => {
    const json = path.join(RUNS, d, "report.json");
    if (!fs.existsSync(path.join(RUNS, d, "report.md")) || !fs.existsSync(json)) return false;
    try {
      const report = JSON.parse(fs.readFileSync(json, "utf-8"));
      return report.provider !== "faux" && report.paired === true;
    } catch {
      return false;
    }
  });
  runId = usable.pop();
  if (!runId) {
    die(
      "--skip-eval given, but no live paired run exists under tests/eval/runs/",
      "  A reusable run has to be one a release could have been cut from: live, and\n" +
        "  with a baseline arm. Drop --skip-eval to measure now.",
    );
  }
  info(`reusing ${runId}`);
} else {
  const before = fs.existsSync(RUNS) ? new Set(fs.readdirSync(RUNS)) : new Set();
  // Standard OpenRouter routing on the pinned DeepSeek model. EVAL_SCRIPT can
  // still select another repository-defined command, but there is one default.
  const evalScript = process.env.EVAL_SCRIPT ?? "test:skill-behavior:paired";
  info(`every case, both arms — running ${evalScript}`);
  run("npm", ["run", evalScript], {
    cwd: TESTS,
    allowFailure: true, // failing cases are a finding, not a release blocker
  });
  const after = fs.existsSync(RUNS) ? fs.readdirSync(RUNS) : [];
  runId = after.filter((d) => !before.has(d)).sort().pop();
  if (!runId) die("the eval produced no run directory");
}

const runDir = path.join(RUNS, runId);
const reportPath = path.join(runDir, "report.md");
const jsonPath = path.join(runDir, "report.json");
if (!fs.existsSync(reportPath)) die(`run ${runId} has no report.md`);
ok(`run ${runId}`);

const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

// A release headline must come from a real, paired measurement. A faux run has
// no baseline arm, so it reports every case as carried by the skill — a number
// that looks spectacular and means nothing.
if (data.provider === "faux") {
  die(
    `run ${runId} used the deterministic provider`,
    "  A faux run scripts its own answers. It exercises the harness, not the skills,\n" +
      "  and its pass rate is not a measurement.\n\n" +
      "  Drop --skip-eval, or point it at a live run.",
  );
}
if (!data.paired) {
  die(
    `run ${runId} has no baseline arm`,
    "  Without a without-skill arm there is nothing to attribute the result to.\n\n" +
      "  Re-run with EVAL_BASELINE=1, or drop --skip-eval.",
  );
}

// v0.3.0 shipped a headline of "7/67 with the skills, 5/67 without". OpenRouter
// had throttled the burst; 131 of 134 runs came back empty. The trace of a
// refused request looks exactly like an agent that answered briefly and stopped,
// so nothing upstream noticed and the number read as a real result.
const refused = data.providerFailures ?? data.cases.filter((c) => c.withSkill.error).length;
if (refused > 0) {
  die(
    `run ${runId} has ${refused}/${data.cases.length} runs the provider did not answer`,
    "  Rate limiting, truncation, or an outage. Those cases measured nothing, and a\n" +
      "  pass rate computed over them is not a result — it is the shape of the failure.\n\n" +
      "  Wait for the limit to clear and re-run. Lower concurrency with EVAL_CONCURRENCY\n" +
      "  if it keeps happening.",
  );
}

const total = data.cases.length;
const withPass = data.cases.filter((c) => c.withSkill.passed).length;
const withoutPass = data.cases.filter((c) => c.withoutSkill?.passed).length;
const charged = data.totals.withSkill.costUsd + data.totals.withoutSkill.costUsd;
const notional = (data.totals.withSkill.notionalUsd ?? 0) + (data.totals.withoutSkill.notionalUsd ?? 0);
/**
 * What the release headline quotes.
 *
 * A subscription run is charged nothing, so `charged` is honestly zero and tells
 * a reader nothing about how much work the run was. Fall back to the same tokens
 * priced at list, labelled so the two are never confused.
 */
const usingNotional = charged === 0 && notional > 0;
const cost = (usingNotional ? notional : charged).toFixed(4);
const costLabel = usingNotional ? " (equivalent at list price; subscription run, nothing charged)" : "";
const delta = withPass - withoutPass;

const bySuite = {};
for (const c of data.cases) {
  const s = (bySuite[c.suite] ??= { with: 0, without: 0, total: 0 });
  s.total += 1;
  if (c.withSkill.passed) s.with += 1;
  if (c.withoutSkill?.passed) s.without += 1;
}

info(`with skill ${withPass}/${total}   baseline ${withoutPass}/${total}   delta ${delta >= 0 ? "+" : ""}${delta}   $${cost}`);
if (delta <= 0) {
  process.stdout.write(
    `\n    ${bold("⚠ the skills did not beat the baseline on this run.")}\n` +
      `    ${dim("Not a blocker — but say so in the changelog rather than shipping quietly.")}\n`,
  );
}

// --- 4. report -------------------------------------------------------------

step("Report — write LATEST-EVAL-REPORT.md");

const body = fs.readFileSync(reportPath, "utf-8").split("\n").slice(1).join("\n").replace(/^\n+/, "");
const suiteRows = Object.entries(bySuite)
  .map(([name, s]) => `| \`${name}\` | ${s.with}/${s.total} | ${s.without}/${s.total} | **${s.with - s.without >= 0 ? "+" : ""}${s.with - s.without}** |`)
  .join("\n");

const header = `# Latest eval report — ${version}

**Tag:** \`${version}\`
**Run:** \`${runId}\`
**Model:** \`${data.model}\` at \`${data.thinking}\` thinking
**Command:** \`npm run release ${version}\`

Generated by \`tests/eval/\`. Every case ran twice — once with the skill catalog in the system
prompt, once without — inside a rootless container with a writable workspace. The delta between
arms is what the skills are worth; the absolute pass rate is not.

Reproduce with \`npm run test:skill-behavior:paired\`. Run \`npm run test:sandbox\` first: a green suite means nothing
until the assertions have been shown capable of failing.

## Headline

| Suite | With skill | Without | Delta |
| --- | ---: | ---: | ---: |
${suiteRows}
| **Total** | **${withPass}/${total}** | **${withoutPass}/${total}** | **${delta >= 0 ? "+" : ""}${delta}** |

Run cost, both arms: **$${cost}**${costLabel}.

## How to read this

Cases that pass in **both** arms measure nothing about the skill — the baseline already satisfies
them. They are regression guards. Cases that fail in both arms are work the skill does not yet do.
Only the "carried by the skill" list is evidence that a skill earns its tokens.

One model, one thinking level, one run. Treat it as a baseline, not a settled result.

---

`;

if (DRY_RUN) {
  info(`would write ${path.relative(ROOT, REPORT)} (${header.length + body.length} bytes)`);
} else {
  fs.writeFileSync(REPORT, header + body);
  ok(`wrote ${path.relative(ROOT, REPORT)}`);
}

// --- 5. commit -------------------------------------------------------------

step("Commit");

const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
if (pkg.version !== bare) {
  if (DRY_RUN) info(`would set package.json version ${pkg.version} -> ${bare}`);
  else {
    pkg.version = bare;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    ok(`package.json version -> ${bare}`);
  }
}

if (DRY_RUN) {
  info("would commit LATEST-EVAL-REPORT.md and package.json");
} else {
  run("git", ["add", "LATEST-EVAL-REPORT.md", "package.json"], { capture: true });
  const staged = git("diff", "--cached", "--name-only");
  if (staged) {
    run("git", ["commit", "-m", `Release ${version}: eval report and version`], { capture: true });
    ok(`committed ${staged.split("\n").length} file(s)`);
  } else {
    info("nothing to commit");
  }
}

// --- 6. tag ----------------------------------------------------------------

step("Tag");

const section = changelog.split(`## [${bare}]`)[1]?.split("\n## ")[0] ?? "";
const summary = section
  .split("\n")
  .filter((l) => l.startsWith("**") || (l.startsWith("- ") && l.length < 100))
  .slice(0, 8)
  .join("\n");

const message = `${version}

${summary || "See CHANGELOG.md."}

Eval: ${withPass}/${total} with the skills against ${withoutPass}/${total} without (${delta >= 0 ? "+" : ""}${delta} cases), run cost $${cost}${costLabel}, model ${data.model}.
Full report in LATEST-EVAL-REPORT.md, including known defects.`;

if (DRY_RUN) {
  info("would create annotated tag:");
  process.stdout.write(message.split("\n").map((l) => `      ${dim(l)}`).join("\n") + "\n");
} else {
  run("git", ["tag", "-a", version, "-m", message], { capture: true });
  ok(`tagged ${version}`);
}

// --- 7. push ---------------------------------------------------------------

step("Push");

if (DRY_RUN || NO_PUSH) {
  info(`would push: git push origin main && git push origin ${version}`);
} else {
  run("git", ["push", "origin", "main"], { capture: true });
  ok("pushed main");
  run("git", ["push", "origin", version], { capture: true });
  ok(`pushed ${version}`);
}

// --- done ------------------------------------------------------------------

process.stdout.write(
  `\n${bold(DRY_RUN ? `Dry run complete — ${version} not cut` : `${version} released`)}\n` +
    `    ${withPass}/${total} with the skills, ${withoutPass}/${total} without, $${cost}${costLabel}\n` +
    (DRY_RUN || NO_PUSH ? "" : `    https://github.com/iammrduncan/skills/releases/tag/${version}\n`) +
    "\n",
);
