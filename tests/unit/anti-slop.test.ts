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
function lintWithOnly(ruleName: string, fixture: string): string[] {
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

  const result = spawnSync(OXLINT, [path.basename(target)], { cwd: root, encoding: "utf-8" });
  fs.rmSync(root, { recursive: true, force: true });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(
    !/failed to load|error: unexpected|panicked/i.test(output),
    `oxlint could not run the plugin:\n${output}`,
  );
  return output
    .split("\n")
    .filter((line) => line.includes(`anti-slop(${ruleName})`))
    .map((line) => line.trim());
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
      const expected = fs.readFileSync(fires, "utf-8").split("\n").filter((l) => l.trim().length > 0).length;
      assert.ok(found.length > 0, `${ruleName} never fired on its own failing fixture`);
      // Every non-blank line of a fires fixture is a case, give or take the
      // wrapper lines of a test block; require broad coverage, not exactness.
      assert.ok(found.length >= Math.min(2, expected), `${ruleName} fired only ${found.length} times`);
      // The message is the intervention: it must carry the correction and name
      // the cheap wrong fix, or the rule teaches the suppression.
      for (const line of found) {
        assert.match(line, /Do: /, `${ruleName} emitted no Do: clause`);
        assert.match(line, /Never: /, `${ruleName} emitted no Never: clause`);
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

  it("ships twenty rules", () => {
    assert.equal(Object.keys(RULES).length, 20);
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
      const findings = checkText(fs.readFileSync(doc, "utf-8"), doc, VOCAB);
      assert.deepEqual(findings.map((f) => `${f.rule}: ${f.text}`), [], `${doc} has findings`);
    }
  });
});
