/**
 * Tests for skills/general/simplified-technical-english/scripts/ste_lint.mjs.
 *
 *   npm run test:unit
 *
 * These use the real shipped dataset, because the linter's behaviour is mostly a
 * function of that data and a stub dictionary would test nothing worth knowing.
 * Tests that only exercise counting or splitting need no data at all.
 *
 * Ported from the original Python suite. The linter was proven byte-identical to
 * that implementation across 186 differential cases before the Python was
 * removed, so a failure here is a real regression, not a porting artifact.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkText,
  countWords,
  Dictionary,
  splitSentences,
  type Finding,
} from "../../skills/general/simplified-technical-english/scripts/ste_lint.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "..", "..", "skills", "general", "simplified-technical-english");
const LINTER = path.join(SKILL, "scripts", "ste_lint.mjs");
const DATA = path.join(SKILL, "scripts", "ste100-lint.json");
const GUIDE = path.join(SKILL, "reference", "ste-guide.md");

if (!fs.existsSync(DATA)) {
  throw new Error(`${DATA} not found. It ships next to ste_lint.mjs in scripts/.`);
}
const DICTIONARY = Dictionary.load(DATA);

const check = (text: string, mode = "auto", strict = false): Finding[] =>
  checkText(text, "t.txt", DICTIONARY, mode, strict);

const rules = (findings: Finding[]): string[] => findings.map((f) => f.rule);
const messages = (findings: Finding[]): string => findings.map((f) => f.message).join(" | ");
const withRule = (findings: Finding[], rule: string) => findings.filter((f) => f.rule === rule);

/** Run the linter as a subprocess against a temporary file. */
function runCli(text: string, ...extra: string[]) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ste-")), "t.txt");
  fs.writeFileSync(file, text);
  try {
    return spawnSync(process.execPath, [LINTER, file, ...extra], { encoding: "utf-8" });
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

// --- Word counting (rules 8.4 thru 8.7) ------------------------------------

describe("word count", () => {
  it("counts a plain sentence", () => {
    assert.equal(countWords("Remove the cover from the housing."), 6);
  });

  it("counts parenthetical text as one word", () => {
    // Rule 8.5. The standard's own example: this sentence has 14 words.
    const sentence = "Install the three auxiliary screws (2) in the flange of the motor assembly (9).";
    assert.equal(countWords(sentence), 14);
  });

  it("counts a number with its unit as one word", () => {
    // Rule 8.6: "2 liters" is one word, so this is 8 words not 9.
    assert.equal(countWords("Drain approximately 2 liters of fuel from the tank."), 8);
  });

  it("counts a number without a unit as one word", () => {
    assert.equal(countWords("Torque the bolt to 25."), 5);
  });

  it("recognises a pressure unit", () => {
    assert.equal(countWords("The pressure must be more than 800 kPa."), 7);
  });

  it("counts a hyphenated word as one word", () => {
    // Rule 8.7.
    assert.equal(countWords("Use a word-for-word replacement."), 4);
  });

  it("counts quoted text as one word", () => {
    // Rule 8.6.
    assert.equal(countWords('Set the switch to "ON AND LOCKED".'), 5);
  });

  it("does not count punctuation alone as a word", () => {
    assert.equal(countWords("Stop. -- Go."), 2);
  });

  it("counts an empty string as zero", () => {
    assert.equal(countWords(""), 0);
  });
});

// --- Sentence splitting ----------------------------------------------------

describe("sentence split", () => {
  it("splits on a period", () => {
    assert.deepEqual(splitSentences("Remove the bolt. Install the nut."), [
      "Remove the bolt.",
      "Install the nut.",
    ]);
  });

  it("treats a colon as ending a sentence", () => {
    // Rule 8.4.
    assert.deepEqual(splitSentences("Do the steps that follow: Remove the bolt."), [
      "Do the steps that follow:",
      "Remove the bolt.",
    ]);
  });

  it("does not split on an abbreviation's period", () => {
    assert.deepEqual(splitSentences("Get access to the accumulator for the No. 1 system."), [
      "Get access to the accumulator for the No. 1 system.",
    ]);
  });

  it("treats each line as its own sentence", () => {
    assert.equal(splitSentences("First item\nSecond item").length, 2);
  });
});

// --- Punctuation -----------------------------------------------------------

describe("punctuation", () => {
  it("reports a semicolon", () => {
    assert.ok(rules(check("The unit is serviceable; the test is complete.")).includes("8.1"));
  });

  it("reports nothing when there is no semicolon", () => {
    assert.ok(!rules(check("The unit is serviceable.")).includes("8.1"));
  });

  it("reports a Latin abbreviation with its replacement", () => {
    const found = check("Use a soft cloth, e.g. cotton.");
    assert.ok(rules(found).includes("GR-6"));
    assert.match(messages(found), /FOR EXAMPLE/);
  });

  it("reports etc.", () => {
    assert.ok(rules(check("Remove the bolts, nuts, etc.")).includes("GR-6"));
  });

  it("does not report a word that merely contains a Latin abbreviation", () => {
    // "vs." inside "revs." must not match, nor "ca." inside "vertica.".
    assert.ok(!rules(check("Count the revs. Then stop.")).includes("GR-6"));
  });

  it("reports a contraction", () => {
    // Rule 4.2.
    assert.ok(rules(check("Do not remove the cover if it isn't loose.")).includes("4.2"));
  });

  it("reports the possessive as a warning", () => {
    const found = check("Refer to the manufacturer's instructions.");
    assert.ok(rules(found).includes("GR-8"));
    assert.deepEqual(withRule(found, "GR-8").map((f) => f.severity), ["warning"]);
  });
});

// --- Verb forms ------------------------------------------------------------

describe("verb forms", () => {
  it('reports the "-ing" form used as a verb', () => {
    // Rules 3.2 and 3.5.
    assert.ok(rules(check("The pump is operating at full speed.")).includes("3.2"));
  });

  it('does not report the "-ing" form inside a noun', () => {
    // Rule 3.5 permits it inside a technical noun.
    assert.ok(!rules(check("Open the landing gear door.")).includes("3.2"));
  });

  it("reports the passive voice", () => {
    // Rule 3.6. "installed" is the past participle of the approved INSTALL.
    assert.ok(rules(check("The pump is installed in the compartment.")).includes("3.6"));
  });

  it("makes a named agent an error", () => {
    // "by the technician" settles it: this cannot be a participle adjective.
    const found = check("The pump is installed by the technician.", "procedural");
    assert.deepEqual(withRule(found, "3.6").map((f) => f.severity), ["error"]);
  });

  it("makes an unnamed agent only a warning", () => {
    // Rule 3.3 permits the past participle as an adjective, and it looks
    // identical, so an unnamed agent cannot be called an error.
    const found = check("The pump is installed in the compartment.", "procedural");
    assert.deepEqual(withRule(found, "3.6").map((f) => f.severity), ["warning"]);
  });

  it("does not treat MAKE SURE THAT a state holds as passive", () => {
    // Canonical STE, used throughout the standard: a required condition.
    assert.ok(!rules(check("Make sure that the valve is closed.")).includes("3.6"));
  });

  it("does not report the active voice", () => {
    assert.ok(!rules(check("Install the pump in the compartment.")).includes("3.6"));
  });
});

// --- Approved words --------------------------------------------------------

describe("approved words", () => {
  it("reports a word that is not approved", () => {
    const found = withRule(check("The unit is installed abaft the compartment."), "1.1");
    assert.ok(found.length > 0);
    assert.match(found[0]!.message, /AFT OF/);
  });

  it("names the replacement for a recurring error", () => {
    const found = withRule(check("Ensure the valve is closed."), "1.1");
    assert.ok(found.length > 0);
    assert.match(found[0]!.message, /MAKE SURE/);
  });

  it("does not report an approved word", () => {
    assert.ok(!rules(check("Remove the bolt.")).includes("1.1"));
  });

  it("does not report an inflected form of an approved verb", () => {
    // "connects" resolves through CONNECT via the forms index. Asserted on the
    // word itself: other words may have findings of their own, which would make
    // a whole-sentence assertion prove nothing.
    assert.equal(DICTIONARY.status("connects"), "approved");
    const found = check("Plug A connects to socket B.");
    assert.deepEqual(found.filter((f) => f.message.includes("connects")), []);
  });

  it("does not report an irregular past tense", () => {
    assert.ok(!rules(check("This section gave the procedures.")).includes("1.1"));
  });

  it("does not report an unknown word by default", () => {
    // Rule 1.5: any technical noun is permitted, and is absent from the
    // dictionary by definition.
    assert.ok(!rules(check("Remove the flanged spigot.")).includes("1.1"));
  });

  it("lists an unknown word in strict mode", () => {
    assert.ok(rules(check("Remove the flanged spigot.", "auto", true)).includes("1.5"));
  });

  it("accepts a spelling approved under any part of speech", () => {
    // CHECK (n) is approved while check (v) is not. Which one a sentence means
    // needs the part of speech in context, so the spelling is accepted; rule 1.2
    // is one this tool cannot decide.
    assert.equal(DICTIONARY.status("check"), "approved");
    assert.deepEqual(withRule(check("Do the check of the container."), "1.1"), []);
  });

  it("takes the rule 1.5 path for a word offered as a technical noun", () => {
    // "cover (v)" is not approved and its alternative is COVER (TN), so the more
    // precise finding is rule 1.5: permitted as a technical noun.
    assert.ok(DICTIONARY.technicalTerms().has("cover"));
    const found = check("Cover the container.").filter((f) => f.message.includes("Cover"));
    assert.ok(found.length > 0);
    assert.equal(found[0]!.rule, "1.5");
  });

  it("does not make a word offered as a technical noun an error", () => {
    // The dictionary tells "fail (v)" and "glitch (n)" to use FAILURE (TN),
    // while separately rejecting "failure (n)" as a plain noun. Calling FAILURE
    // forbidden would contradict the dictionary's own advice.
    assert.ok(DICTIONARY.technicalTerms().has("failure"));
    // Filtered by word, not by position: other words in the sentence have
    // findings of their own and a positional index would be brittle.
    const found = check("EXAMINE THE PUMP FOR A FAILURE.").filter((f) => f.message.includes("FAILURE"));
    assert.ok(found.length > 0);
    assert.equal(found[0]!.severity, "warning");
    assert.equal(found[0]!.rule, "1.5");
  });

  it("treats interference as a technical noun too", () => {
    assert.deepEqual(withRule(check("MEASURE THE INTERFERENCE AT THE JOINT."), "1.1"), []);
  });

  it("reports a verb-only rejection in a noun position as informational", () => {
    // "fuel (v)" is not approved, but "of fuel" is a noun, which rule 1.5
    // permits as a technical noun.
    const found = check("Drain the fuel from the tank.").filter((f) => ["1.1", "1.5"].includes(f.rule));
    assert.ok(found.length > 0);
    assert.equal(found[0]!.severity, "info");
  });
});

// --- Length limits ---------------------------------------------------------

describe("length", () => {
  it("reports a long procedural sentence", () => {
    // Rule 5.1: 20 words maximum. This has 24.
    const sentence =
      "Remove the bolt and the nut and the washer and the spacer and the shim " +
      "and the clip and the pin and the seal.";
    const found = withRule(check(sentence, "procedural"), "5.1");
    assert.ok(found.length > 0);
    assert.match(found[0]!.message, /24 words/);
  });

  it("permits a twenty-word procedural sentence", () => {
    const sentence = ["Remove", ...Array(19).fill("bolt")].join(" ") + ".";
    assert.equal(countWords(sentence), 20);
    assert.ok(!rules(check(sentence, "procedural")).includes("5.1"));
  });

  it("uses twenty-five words for descriptive writing", () => {
    const sentence = "The " + Array(25).fill("pump").join(" ") + ".";
    assert.equal(countWords(sentence), 26);
    assert.ok(rules(check(sentence, "descriptive")).includes("6.3"));
  });

  it("reports a long paragraph", () => {
    // Rule 6.6: six sentences maximum.
    const paragraph = Array.from({ length: 8 }, (_, n) => `The pump has a value of ${n + 1}.`).join(" ");
    assert.ok(rules(check(paragraph, "descriptive")).includes("6.6"));
  });

  it("permits a six-sentence paragraph", () => {
    const paragraph = Array.from({ length: 6 }, (_, n) => `The pump has a value of ${n + 1}.`).join(" ");
    assert.ok(!rules(check(paragraph, "descriptive")).includes("6.6"));
  });

  it("does not apply the paragraph limit to procedures", () => {
    const steps = Array.from({ length: 9 }, (_, n) => `${n + 1}. Remove the bolt.`).join("\n");
    assert.ok(!rules(check(steps, "procedural")).includes("6.6"));
  });
});

// --- Multi-word nouns ------------------------------------------------------

describe("multi-word nouns", () => {
  it("reports a long multi-word noun", () => {
    // Rule 2.1: three words maximum.
    assert.ok(rules(check("Runway light connection resistance calibration is necessary.")).includes("2.1"));
  });

  it("permits a three-word multi-word noun", () => {
    assert.ok(!rules(check("The runway light connection is loose.")).includes("2.1"));
  });

  it("ends a run at punctuation", () => {
    // Two short noun groups separated by a comma are not one long one.
    assert.ok(!rules(check("Install the bolt, washer and nut.")).includes("2.1"));
  });
});

// --- Command form ----------------------------------------------------------

describe("command form", () => {
  it("reports an instruction that does not start with a verb", () => {
    // Rules 3.2 and 5.3.
    assert.ok(rules(check("The bolt must be removed by the technician.", "procedural")).includes("5.3"));
  });

  it("does not report an imperative instruction", () => {
    assert.ok(!rules(check("Remove the bolt.", "procedural")).includes("5.3"));
  });

  it("permits a condition before the command", () => {
    // Rule 5.4.
    assert.ok(!rules(check("If the values are incorrect, stop the test.", "procedural")).includes("5.3"));
  });

  it("permits a numbered step", () => {
    assert.ok(!rules(check("1. Remove the bolt.", "procedural")).includes("5.3"));
  });
});

// --- Mode detection --------------------------------------------------------

describe("mode detection", () => {
  it("reads a numbered step as procedural", () => {
    // 22 words: over the procedural limit of 20, under the descriptive 25.
    const sentence = "1. Remove " + Array(20).fill("bolt").join(" ") + " now.";
    assert.ok(rules(check(sentence, "auto")).includes("5.1"));
  });

  it("reads prose as descriptive", () => {
    const sentence = "The system " + Array(19).fill("pump").join(" ") + " operates.";
    assert.equal(countWords(sentence), 22);
    assert.ok(!rules(check(sentence, "auto")).includes("5.1"));
  });
});

// --- Determinism -----------------------------------------------------------

describe("determinism", () => {
  it("gives identical output for identical input", () => {
    const text = "Ensure the valve is operable; e.g. it isn't seized.\n\nThe pump is installed.";
    const first = check(text).map((f) => f.format());
    const second = check(text).map((f) => f.format());
    assert.deepEqual(first, second);
    assert.ok(first.length > 0);
  });

  it("sorts findings by position", () => {
    const text = "Ensure the valve is operable and the unit is installed abaft the compartment.";
    const found = check(text);
    const positions = found.map((f) => [f.line, f.column] as const);
    const sorted = [...positions].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    assert.deepEqual(positions, sorted);
  });
});

// --- The dataset -----------------------------------------------------------

describe("data file", () => {
  it("finds the dataset next to the script", () => {
    assert.ok(fs.existsSync(Dictionary.find()));
  });

  it("rejects an unsupported schema", () => {
    assert.throws(() => new Dictionary({ schema: "something-else/9" } as never), /unsupported data schema/);
  });

  it("holds the published totals", () => {
    assert.equal(DICTIONARY.data.counts.approved_verbs, DICTIONARY.data.approved_verbs.length);
    assert.equal(DICTIONARY.data.rules.length, 61); // 53 rules + 8 GRs
  });

  it("has limits matching the rules", () => {
    assert.equal(DICTIONARY.limits.max_words_per_procedural_sentence, 20);
    assert.equal(DICTIONARY.limits.max_words_per_descriptive_sentence, 25);
    assert.equal(DICTIONARY.limits.max_sentences_per_paragraph, 6);
    assert.equal(DICTIONARY.limits.max_words_per_multi_word_noun, 3);
  });

  it("resolves inflected forms to headwords", () => {
    assert.equal(DICTIONARY.forms.connects, "CONNECT");
    assert.equal(DICTIONARY.forms.gave, "GIVE");
  });
});

// --- The command line ------------------------------------------------------

describe("command line", () => {
  it("exits zero on clean text", () => {
    const result = runCli("Remove the bolt from the flange.\n");
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("exits one on text with an error", () => {
    const result = runCli("Ensure the valve is closed.\n");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /MAKE SURE/);
  });

  it("exits zero with --fail-on never", () => {
    assert.equal(runCli("Ensure the valve is closed.\n", "--fail-on", "never").status, 0);
  });

  it("emits valid JSON with --json", () => {
    const result = runCli("Ensure the valve is closed.\n", "--json");
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.issue, 9);
    assert.ok(payload.counts.error > 0);
    assert.ok("rule" in payload.findings[0]);
  });

  it("exits two on a missing file", () => {
    const result = spawnSync(process.execPath, [LINTER, "no-such-file.txt"], { encoding: "utf-8" });
    assert.equal(result.status, 2);
  });

  it("reads stdin", () => {
    const result = spawnSync(process.execPath, [LINTER, "-"], {
      input: "Ensure the valve is closed.\n",
      encoding: "utf-8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /<stdin>/);
  });
});

// --- Regressions -----------------------------------------------------------

describe("regressions", () => {
  it("does not let forms of BE extend a multi-word noun", () => {
    // "is" is a form of BE, not a headword, so an early version of
    // isNounCandidate() treated it as an unknown technical noun and let runs
    // grow straight through it.
    assert.deepEqual(withRule(check("The control unit is installed correctly."), "2.1"), []);
  });

  it("does not count help text as an approved form", () => {
    // "No other verb forms." is help text in the dictionary, not a form.
    assert.ok(!("no other verb forms" in DICTIONARY.forms));
  });

  it("looks up multi-word headwords", () => {
    assert.ok(DICTIONARY.variants("make sure").length > 0);
  });

  it("does not produce an empty sentence from a trailing colon", () => {
    assert.ok(!splitSentences("Do the steps that follow:").includes(""));
  });
});

// --- Direct-entry invocation -------------------------------------------------

describe("direct-entry invocation", () => {
  it("runs main() when invoked directly", () => {
    const result = spawnSync(process.execPath, [LINTER, "--version"], { encoding: "utf-8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^\S+ \d+\.\d+\.\d+/);
  });

  it("runs main() through a path containing spaces", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-entry "));
    const copy = path.join(root, "ste_lint.mjs");
    fs.copyFileSync(LINTER, copy);
    const result = spawnSync(process.execPath, [copy, "--version"], { encoding: "utf-8" });
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^\S+ \d+\.\d+\.\d+/);
  });

  it("runs main() when invoked through a symlink", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-entry-symlink-"));
    const link = path.join(root, "ste_lint.mjs");
    try {
      fs.symlinkSync(LINTER, link);
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
});

// --- The shipped package ---------------------------------------------------

describe("shipped package", () => {
  it("has all three parts present", () => {
    for (const target of [LINTER, DATA, GUIDE]) {
      assert.ok(fs.existsSync(target), target);
    }
  });

  it("finds its data with no arguments", () => {
    // The data file must sit where ste_lint.mjs's own search finds it, or every
    // command in the playbooks needs a --data flag.
    const result = spawnSync(process.execPath, [LINTER, "-"], {
      input: "Make sure that the panel is attached.\n",
      encoding: "utf-8",
    });
    assert.doesNotMatch(result.stderr, /not found/);
    assert.notEqual(result.status, 2, result.stderr);
  });

  it("keeps the guide under 500 lines", () => {
    const lines = fs.readFileSync(GUIDE, "utf-8").split("\n");
    assert.ok(lines.length < 500, `the guide is ${lines.length} lines`);
  });

  it("covers every rule in the guide", () => {
    // A rule missing from the guide means a finding a reader cannot look up.
    const guide = fs.readFileSync(GUIDE, "utf-8");
    const missing = Object.keys(DICTIONARY.rules).filter((r) => !guide.includes(`**${r}`));
    assert.deepEqual(missing, []);
  });

  it("carries no dictionary examples in the guide", () => {
    // The point of the summary is that it reproduces no example sentences. Every
    // STE example in the standard is uppercase, so any long uppercase run in the
    // guide would be copied text.
    const guide = fs.readFileSync(GUIDE, "utf-8");
    const shouted = guide.match(/\b[A-Z][A-Z ]{25,}\b/g) ?? [];
    assert.deepEqual(shouted, []);
  });

  it("ships no Python", () => {
    // The linter was ported to ESM and the Python removed. A stray .py would
    // mean the two implementations had drifted back apart.
    const found = execFileSync("find", [SKILL, "-name", "*.py"], { encoding: "utf-8" }).trim();
    assert.equal(found, "", `unexpected Python in the skill:\n${found}`);
  });
});
