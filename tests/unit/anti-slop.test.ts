/**
 * Tests for skills/general/anti-slop.
 *
 *   npm run test:unit
 *
 * Three checkers, one contract: every rule must be shown capable of firing, and
 * shown capable of staying quiet. A rule that has never fired is not a check,
 * and a rule that has never stayed quiet is a false-positive generator.
 *
 * The Oxlint rules run through real Oxlint rather than a hand-built AST, because
 * the thing worth testing is that they work in the engine they ship for. Each
 * rule is linted against its own fixtures with only that rule enabled, so a
 * finding can only have come from the rule under test.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RULES } from "../../skills/general/anti-slop/scripts/oxlint/index.mjs";
import {
  checkRepository,
  declaredTestGlobs,
  globToRegExp,
  listFiles,
  Rules,
  tokenise,
} from "../../skills/general/anti-slop/scripts/structure_lint.mjs";
import {
  checkText,
  splitSentences,
  stripNonProse,
  Vocabulary,
  selfTest,
  compilePattern,
  loadPolicy,
  parseArgs,
} from "../../skills/general/anti-slop/scripts/prose_lint.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SKILL = path.join(REPO, "skills", "general", "anti-slop");
const PLUGIN = path.join(SKILL, "scripts", "oxlint");
const FIXTURES = path.join(PLUGIN, "fixtures");
const OXLINT = path.join(HERE, "..", "node_modules", ".bin", "oxlint");

const STRUCTURE_RULES = Rules.load(path.join(SKILL, "scripts", "structure-lint.json"));
const VOCAB = Vocabulary.load(path.join(SKILL, "scripts", "prose-lint.json"));

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "anti-slop-"));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

const structureRulesFired = (root: string): string[] =>
  checkRepository(root, STRUCTURE_RULES).findings.map((f) => f.rule);

/** Lint one fixture with exactly one rule enabled. Returns that rule's findings. */
interface Diagnostic { message: string; labels: { span: { line: number; column: number } }[]; code: string }
function lintWithOnly(ruleName: string, fixture: string): Diagnostic[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oxlint-"));
  fs.cpSync(PLUGIN, path.join(root, "plugin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".oxlintrc.json"),
    JSON.stringify({
      jsPlugins: ["./plugin/index.mjs"],
      rules: { [`anti-slop/${ruleName}`]: "error" },
    }),
  );
  const target = path.join(root, path.basename(fixture));
  fs.copyFileSync(fixture, target);

  const result = spawnSync(OXLINT, [path.basename(target), "--format", "json"], { cwd: root, encoding: "utf-8" });
  fs.rmSync(root, { recursive: true, force: true });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(
    !/failed to load|error: unexpected|panicked/i.test(output),
    `oxlint could not run the plugin:\n${output}`,
  );
  assert.ok(!result.error, String(result.error));
  const report = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] };
  return report.diagnostics.filter((d) => d.code === `anti-slop(${ruleName})`);
}

describe("oxlint rules run in the engine they ship for", () => {
  for (const ruleName of Object.keys(RULES)) {
    const fires = path.join(FIXTURES, `${ruleName}.fires.ts`);
    const passes = path.join(FIXTURES, `${ruleName}.passes.ts`);

    it(`${ruleName} ships both fixtures`, () => {
      assert.ok(fs.existsSync(fires), `missing ${ruleName}.fires.ts`);
      assert.ok(fs.existsSync(passes), `missing ${ruleName}.passes.ts`);
    });

    it(`${ruleName} fires on every case in its failing fixture`, () => {
      const found = lintWithOnly(ruleName, fires);
      // Each statement is a case. Wrapper/declaration lines do not claim a hit.
      const lines = fs.readFileSync(fires, "utf-8").split("\n");
      const expected = lines.flatMap((line, index) => {
        if (!line.trim() || /^test\("proves nothing"|^\s*\}\);/.test(line)) return [];
        if (ruleName === "require-suppression-reason") return line.trim().startsWith("//") ? [index + 1] : [];
        if (ruleName === "no-widen-then-assert" && !/\bas\b/.test(line)) return [];
        const count = ruleName === "no-object-parameters" ? Math.max(1, [...line.matchAll(/:\s*object\b/g)].length) : 1;
        return Array.from({ length: count }, () => index + 1);
      });
      assert.ok(expected.length > 0, `${ruleName} has no declared failing cases`);
      assert.deepEqual(found.map((d) => d.labels[0]?.span.line).sort((a, b) => (a ?? 0) - (b ?? 0)), expected,
        `${ruleName} must diagnose every case at its source line, without extra findings`);
      // The message is the intervention: it must carry the correction and name
      // the cheap wrong fix, or the rule teaches the suppression.
      for (const diagnostic of found) {
        assert.ok(diagnostic.labels[0]!.span.column > 0);
        assert.match(diagnostic.message, /Do: /, `${ruleName} emitted no Do: clause`);
        assert.match(diagnostic.message, /Never: /, `${ruleName} emitted no Never: clause`);
      }
    });

    it(`${ruleName} stays quiet on legitimate code`, () => {
      assert.deepEqual(lintWithOnly(ruleName, passes), []);
    });
  }

  it("exports a rule for every fixture pair on disk", () => {
    // The set difference both ways: a fixture with no rule is dead weight, and
    // it is how a renamed rule silently stops being tested.
    const onDisk = new Set(
      fs.readdirSync(FIXTURES).map((f) => f.replace(/\.(fires|passes)\.ts$/, "")),
    );
    assert.deepEqual([...onDisk].sort(), Object.keys(RULES).sort());
  });

  it("gives every rule a description", () => {
    for (const [name, rule] of Object.entries(RULES)) {
      assert.ok(rule.meta?.docs?.description, `${name} has no description`);
    }
  });


});

describe("structure rules", () => {
  for (const rule of STRUCTURE_RULES.data.rules) {
    it(`${rule.id} fires on its own failing fixture`, () => {
      const root = tree(rule.fixtures.fires);
      assert.ok(structureRulesFired(root).includes(rule.id));
      fs.rmSync(root, { recursive: true, force: true });
    });

    it(`${rule.id} stays quiet on its own passing fixture`, () => {
      const root = tree(rule.fixtures.passes);
      assert.ok(!structureRulesFired(root).includes(rule.id));
      fs.rmSync(root, { recursive: true, force: true });
    });
  }

  it("derives test roots from a runner config", () => {
    const root = tree({
      "vitest.config.ts": 'export default { test: { include: ["tests/**/*.test.ts"] } }\n',
      "tests/a.test.ts": "",
    });
    assert.deepEqual(declaredTestGlobs(root, listFiles(root)).globs, ["tests/**/*.test.ts"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("derives test roots from a test script's own globs", () => {
    const root = tree({
      "tests/package.json": '{ "scripts": { "test:unit": "tsx --test unit/*.test.ts" } }',
      "tests/unit/a.test.ts": "",
    });
    assert.deepEqual(declaredTestGlobs(root, listFiles(root)).globs, ["tests/unit/*.test.ts"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("skips rather than guesses when nothing declares a test root", () => {
    const root = tree({ "package.json": '{ "name": "x" }', "src/stray.test.ts": "" });
    const { findings, notChecked } = checkRepository(root, STRUCTURE_RULES);
    assert.equal(findings.filter((f) => f.rule === "no-uncollected-test").length, 0);
    assert.deepEqual(notChecked.map((n) => n.rule), ["no-uncollected-test"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("treats a fixture tree as data, not code", () => {
    const root = tree({
      "vitest.config.ts": 'export default { test: { include: ["tests/**/*.test.ts"] } }\n',
      "suite/fixtures/example.test.mjs": "it('x', () => {})\n",
      "scripts/fixtures/sample.sh": "#!/bin/sh\n",
    });
    assert.deepEqual(structureRulesFired(root), []);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("accepts a script named only by a CI workflow or a document", () => {
    const byCi = tree({
      ".github/workflows/ci.yml": "jobs:\n  a:\n    steps:\n      - run: ./scripts/deploy.sh\n",
      "scripts/deploy.sh": "",
    });
    const byDoc = tree({ "README.md": "Run `scripts/seed.sh` first.\n", "scripts/seed.sh": "" });
    assert.ok(!structureRulesFired(byCi).includes("no-orphan-script"));
    assert.ok(!structureRulesFired(byDoc).includes("no-orphan-script"));
    for (const root of [byCi, byDoc]) fs.rmSync(root, { recursive: true, force: true });
  });

  it("expands globs and splits names the way the rules assume", () => {
    assert.ok(globToRegExp("tests/**/*.test.ts").test("tests/unit/a.test.ts"));
    assert.ok(!globToRegExp("tests/*.test.ts").test("tests/unit/a.test.ts"));
    assert.deepEqual(tokenise("userCreate.ts"), ["user", "create"]);
  });
});

describe("prose rules", () => {
  for (const rule of VOCAB.data.rules) {
    it(`${rule.id} fires on every sentence it should catch`, () => {
      for (const sentence of rule.fixtures.fires) {
        assert.ok(
          checkText(sentence, "f.md", VOCAB).some((f) => f.rule === rule.id),
          `${rule.id} missed: ${sentence}`,
        );
      }
    });

    it(`${rule.id} stays quiet on every sentence it should allow`, () => {
      for (const sentence of rule.fixtures.passes) {
        assert.ok(
          !checkText(sentence, "f.md", VOCAB).some((f) => f.rule === rule.id),
          `${rule.id} false-positived on: ${sentence}`,
        );
      }
    });
  }

  it("drives every example in the data file, patterns included", () => {
    // This is the same check `--self-test` runs. It is the contract that makes
    // the pattern list safe to edit: an entry that cannot fire is not a rule,
    // and one that fires on its own counter-example is a false-positive source.
    assert.deepEqual(selfTest(VOCAB), []);
  });

  it("requires every pattern to ship an example that fires", () => {
    for (const pattern of VOCAB.patterns) {
      assert.ok(pattern.fires.length > 0, `${pattern.id} ships no firing example`);
    }
    assert.throws(
      () => compilePattern({ id: "x", match: "y" }),
      /ships no "fires" example/,
      "a pattern with no example should be rejected at load",
    );
  });

  it("lets a flagged word through in its legitimate technical use", () => {
    const fires = (s: string) => checkText(s, "f.md", VOCAB).some((f) => f.rule === "no-empty-metaphor");
    assert.ok(fires("The seam between the two services is where it gets messy."));
    assert.ok(!fires("A seam lets you change behaviour without editing the code under test."));
    assert.ok(fires("This is the load-bearing part of the argument."));
    assert.ok(!fires("The load-bearing wall carries the roof above it."));
  });

  it("does not flag a word inside quotation marks", () => {
    // A style guide has to be able to name the words it bans.
    assert.deepEqual(checkText('Avoid "load-bearing" as a metaphor.', "f.md", VOCAB), []);
  });

  it("gives a plain phrase word boundaries", () => {
    const fires = (s: string) => checkText(s, "f.md", VOCAB).some((f) => f.rule === "no-empty-metaphor");
    assert.ok(!fires("The migration was seamless for the caller."));
  });

  it("decides on the referent, not the vocabulary", () => {
    const fires = (s: string) => checkText(s, "f.md", VOCAB).some((f) => f.rule === "no-unsupported-claim");
    assert.ok(fires("This service is performant."));
    assert.ok(!fires("This service is performant at p99 of 40ms."));
    assert.ok(!fires("The architecture is loosely coupled; see ADR-0007."));
    assert.ok(!fires("Prefer a modular layout when the boundary is obvious."));
  });

  it("joins a claim that wraps across lines", () => {
    assert.equal(splitSentences("The system\nis robust.").length, 1);
    assert.equal(checkText("The system\nis robust.", "f.md", VOCAB).length, 1);
  });

  it("does not read a quoted example as an assertion", () => {
    assert.deepEqual(checkText('Do not write "our design is modular" without evidence.', "f.md", VOCAB), []);
    assert.deepEqual(checkText('Never write "this approach is\nrobust" alone.', "f.md", VOCAB), []);
  });

  it("blanks code before matching, so a word mention is not a claim", () => {
    assert.deepEqual(checkText("The `robust` flag is documented above.", "f.md", VOCAB), []);
    assert.ok(!stripNonProse("a\n```\nthis system is robust\n```\nb").includes("robust"));
  });
});

describe("direct-entry invocation", () => {
  const STRUCTURE_LINTER = path.join(SKILL, "scripts", "structure_lint.mjs");
  const PROSE_LINTER = path.join(SKILL, "scripts", "prose_lint.mjs");

  for (const [name, script] of [
    ["structure_lint.mjs", STRUCTURE_LINTER],
    ["prose_lint.mjs", PROSE_LINTER],
  ] as const) {
    it(`${name} runs main() when invoked directly`, () => {
      const result = spawnSync(process.execPath, [script, "--version"], { encoding: "utf-8" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^\S+ \d+\.\d+\.\d+/);
    });

    it(`${name} runs main() through a path containing spaces`, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-entry "));
      const copy = path.join(root, name);
      fs.copyFileSync(script, copy);
      fs.copyFileSync(path.join(SKILL, "scripts", "prose_review.mjs"), path.join(root, "prose_review.mjs"));
      const result = spawnSync(process.execPath, [copy, "--version"], { encoding: "utf-8" });
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^\S+ \d+\.\d+\.\d+/);
    });

    it(`${name} runs main() when invoked through a symlink`, (t) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-entry-symlink-"));
      const link = path.join(root, name);
      try {
        fs.symlinkSync(script, link);
      } catch (error) {
        fs.rmSync(root, { recursive: true, force: true });
        t.skip(`cannot create symlinks in this environment: ${String(error)}`);
        return;
      }
      const result = spawnSync(process.execPath, [link, "--version"], { encoding: "utf-8" });
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^\S+ \d+\.\d+\.\d+/);
    });
  }
});

describe("this repository is clean", () => {
  it("has no structural findings", () => {
    assert.deepEqual(checkRepository(REPO, STRUCTURE_RULES).findings.map((f) => `${f.rule} ${f.path}`), []);
  });

  it("has no unsupported claims in its own prose", () => {
    const docs = [
      path.join(REPO, "AGENTS.md"),
      path.join(REPO, "README.md"),
      path.join(REPO, "docs", "GOOD_ENGINEERING_H.md"),
      path.join(SKILL, "SKILL.md"),
    ].filter((p) => fs.existsSync(p));
    assert.ok(docs.length > 0, "no documents found — this test proves nothing");
    for (const doc of docs) {
      const findings = checkText(fs.readFileSync(doc, "utf-8"), doc, VOCAB).filter((f) => f.rule === "no-unsupported-claim");
      assert.deepEqual(findings.map((f) => `${f.rule}: ${f.text}`), [], `${doc} has findings`);
    }
  });
});


describe("publication and advisory review", () => {
  const patterns = (source: string) => checkText(source, "f.md", VOCAB).map((f) => f.pattern);
  it("reports residue inside URL targets, tables, comments, inline and fenced code with exact positions", () => {
    for (const source of ["[source](https://site.test/?utm_source=chat)", "[source](https://example.org/?utm_source=chat)", "| turn12search3 |", "<!-- oaicite -->", "`[insert title]`", "```\nturn2view3\n```" ]) {
      const hit = checkText(source, "f.md", VOCAB).find((f) => f.rule === "no-publication-residue")!;
      assert.ok(hit, source);
      const needle = hit.text;
      const offset = source.indexOf(needle);
      assert.equal(hit.line, source.slice(0, offset).split("\n").length);
      assert.equal(hit.column, offset - source.lastIndexOf("\n", offset - 1));
      assert.equal(hit.asObject().pattern, hit.pattern);
    }
  });
  it("allows meaningful tracking examples, Unicode joiners and plain URLs", () => {
    for (const source of ["Analytics campaign: https://site.test/?utm_source=email", "A literal citation handle is turn2search3.", "The Unicode word joiner is \u2060.", "می\u200cروم", "👩\u200d💻", "[source](https://site.test/?page=2)"]) {
      assert.ok(!patterns(source).includes("tracking-parameter"), source);
      assert.ok(!checkText(source, "f.md", VOCAB).some((f) => f.rule === "no-publication-residue"), source);
    }
    assert.ok(patterns("The pub\u200blication text.").includes("zero-width"));
  });
  it("locates individual phrase matches across hard wraps", () => {
    const source = "  The release landed,\n  highlighting our commitment.";
    const hit = checkText(source, "f.md", VOCAB).find((f) => f.pattern === "trailing-commentary")!;
    assert.equal(hit.line, 1);
    assert.equal(hit.column, 21);
    const second = checkText("A report uses a smoking gun metaphor.", "f.md", VOCAB).find((f) => f.pattern === "smoking-gun")!;
    assert.equal(second.column, 17);
  });
  it("checks each phrase identity, not a sibling bucket", () => {
    for (const pattern of VOCAB.patterns) {
      for (const source of pattern.fires) assert.ok(patterns(source).includes(pattern.id), `${pattern.id}: ${source}`);
      for (const source of pattern.passes ?? []) assert.ok(!patterns(source).includes(pattern.id), `${pattern.id}: ${source}`);
    }
    const broken = new Vocabulary({ ...VOCAB.data, patterns: [{ id: "broken", rule: "no-empty-metaphor", match: "absent-token", fires: ["That is the smoking gun."] }, ...VOCAB.data.patterns] });
    assert.ok(selfTest(broken).some((f) => f.startsWith("broken:")));
  });
  const cases = [
    ["short-sentence-run", "It works. We ship. They cheer.", "It works. We ship."],
    ["short-sentence-run", "It works. We ship. They cheer.", "Status: it works. Result: we ship. Outcome: they cheer."],
    ["repeated-triads", "We pack red, green, and blue. We ship amber, white, and black. We test pink, gold, and gray.", "We pack red, green, and blue. We ship amber, white, and black."],
    ["repeated-opener", "We inspect the input.\n\nWe record the output.\n\nWe compare the result.", "We inspect the input.\n\nWe record the output."],
    ["repeated-opener", "We inspect the input.\n\nWe record the output.\n\nWe compare the result.", "The input arrives.\n\nThe output differs.\n\nThe result matches."],
    ["repeated-ending", "## Input\nFirst verify bytes.\n## Output\nFirst verify values.\n## Result\nFirst verify totals.", "## Input\nFirst verify bytes.\n## Output\nFirst verify values."],
    ["adjacent-list-echo", "Inspect headers payloads offsets lengths checksums versions.\n\n- Inspect headers payloads offsets lengths checksums versions.", "Inspect headers payloads offsets lengths.\n\n- Inspect headers payloads offsets lengths."],
  ];
  for (const [id, fires, passes] of cases) it(`${id} preserves its threshold and exception`, () => {
    assert.ok(patterns(fires!).includes(id), fires);
    assert.ok(!patterns(passes!).includes(id), passes);
    const finding = checkText(fires!, "f.md", VOCAB).find((f) => f.pattern === id)!;
    assert.equal(finding.severity, "info");
    assert.equal(finding.line, id === "adjacent-list-echo" ? 3 : id === "repeated-ending" ? 2 : 1);
  });
  it("preserves the exact 60 percent echo and four-word sentence boundaries", () => {
    const paragraph = "header payload offset length checksum version record buffer packet format.";
    assert.ok(patterns(paragraph + "\n\n- header payload offset length checksum version socket stream frame cursor.").includes("adjacent-list-echo"));
    assert.ok(!patterns(paragraph + "\n\n- header payload offset length checksum socket stream frame cursor chunk.").includes("adjacent-list-echo"));
    assert.ok(patterns("We inspect all inputs. We record all outputs. We compare all results.").includes("short-sentence-run"));
    assert.ok(!patterns("We inspect every incoming input. We record every outgoing result. We compare every expected result.").includes("short-sentence-run"));
  });
  it("does not analyse fenced examples or list items as paragraphs", () => {
    assert.ok(!patterns("```\nIt works. We ship. They cheer.\n```").includes("short-sentence-run"));
    assert.ok(!patterns("- It works. We ship. They cheer.").includes("short-sentence-run"));
  });
});

describe("explicit local prose policy", () => {
  const policyPath = path.join(SKILL, "reference", "owner-prose-policy.json");
  const policy = loadPolicy(policyPath);
  it("checks every owner preference and its exception independently", () => {
    for (const pattern of policy.patterns) {
      for (const source of pattern.fires) assert.ok(checkText(source, "f.md", VOCAB, policy).some((f) => f.pattern === pattern.id && f.rule === "local-prose-policy"), pattern.id);
      for (const source of pattern.passes ?? []) assert.ok(!checkText(source, "f.md", VOCAB, policy).some((f) => f.pattern === pattern.id && f.rule === "local-prose-policy"), pattern.id);
    }
    assert.ok(!checkText("This genuinely has shape—yes.", "f.md", VOCAB).some((f) => f.rule === "local-prose-policy"));
    assert.ok(checkText("`x—y`", "f.md", VOCAB, policy).some((f) => f.pattern === "em-dash"));
  });
  it("preserves existing seam and load-bearing technical exceptions", () => {
    for (const source of ["A seam supports legacy testing.", "The load-bearing wall carries the roof."]) {
      assert.ok(!checkText(source, "f.md", VOCAB, policy).some((f) => f.rule === "no-empty-metaphor"));
    }
  });
  it("rejects a missing or empty policy argument", () => {
    for (const args of [["--policy"], ["--policy", ""], ["--policy="], ["--policy", "--json", "f.md"]]) assert.throws(() => parseArgs(args), /policy/);
  });
  it("rejects raw em dashes under default CLI threshold", () => {
    const result = spawnSync(process.execPath, [path.join(SKILL, "scripts", "prose_lint.mjs"), "--policy", policyPath, "-"], { input: "`x—y`", encoding: "utf-8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /error \[local-prose-policy\]/);
    assert.deepEqual(selfTest(VOCAB, policy), []);
  });
  it("reports invalid policy configuration as exit 2", () => {
    const root = tree({ "draft.md": "We read the file.", "bad.json": "{}" });
    try {
      for (const bad of [{}, { patterns: [{ id: "x", match: "x", fires: ["x"], scope: "silent" }] }, { patterns: [{ id: "x", match: "x", fires: ["x"], severity: "fatal" }] }]) {
        fs.writeFileSync(path.join(root, "bad.json"), JSON.stringify(bad));
        const result = spawnSync(process.execPath, [path.join(SKILL, "scripts", "prose_lint.mjs"), "--policy", path.join(root, "bad.json"), path.join(root, "draft.md")], { encoding: "utf-8" });
        assert.equal(result.status, 2, result.stderr);
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it("runs from a copied skill with no install and an explicit policy", () => {
    const root = tree({ "draft.md": "This is genuinely useful." });
    try {
      fs.cpSync(path.join(SKILL, "scripts"), path.join(root, "skill", "scripts"), { recursive: true, filter: (source) => path.basename(source) !== "oxlint" });
      fs.copyFileSync(policyPath, path.join(root, "policy.json"));
      const result = spawnSync(process.execPath, [path.join(root, "skill", "scripts", "prose_lint.mjs"), "--json", "--policy", path.join(root, "policy.json"), "draft.md"], { cwd: root, encoding: "utf-8" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(JSON.parse(result.stdout).findings.some((f: { pattern: string }) => f.pattern === "genuinely"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});


describe("new prose behavior assertions can fail", () => {
  it("accepts each positive script and rejects every negative control", async () => {
    const { PROSE_REVIEW_CASES } = await import("../eval/suites/anti-slop/cases/prose-review.ts");
    const trace = (steps: import("../eval/suites/types.ts").FauxStep[]) => ({
      toolCalls: steps.filter((s) => s.kind === "tool").map((s) => ({ name: s.name, args: s.args, blocked: false })),
      finalText: steps.filter((s) => s.kind === "text").map((s) => s.text).join("\n"),
    });
    for (const c of PROSE_REVIEW_CASES) {
      assert.ok(c.assert(trace(c.script)).passed, `${c.id}: rejected positive`);
      assert.ok(!c.assert(trace(c.negativeControl.script!)).passed, `${c.id}: accepted negative`);
    }
  });
});
