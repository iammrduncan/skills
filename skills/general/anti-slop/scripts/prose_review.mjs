/** Publication, paragraph and local-policy review. Node standard library only.
 * Uses original bytes for residue; prose preparation is supplied by the caller.
 */
import fs from "node:fs";

export class Finding {
  constructor(filePath, line, column, severity, rule, message, text = "") {
    this.path = filePath;
    this.line = line;
    this.column = column;
    this.severity = severity;
    this.rule = rule;
    this.message = message;
    this.text = text;
  }

  format() {
    return `${this.path}:${this.line}:${this.column}: ${this.severity} [${this.rule}] ${this.message}`;
  }

  asObject() {
    return { path: this.path, line: this.line, column: this.column, severity: this.severity, rule: this.rule, message: this.message, text: this.text, ...(this.pattern ? { pattern: this.pattern } : {}) };
  }
}

/**
 * Prepare one entry from the `patterns` array.
 *
 * `match` may be a plain phrase or a regular expression; either way it is given
 * word boundaries, so `seams?` matches "seam" and "seams" but not "seamless".
 * That default is what makes the list safe to edit by hand — the alternative
 * silently turns every entry into a substring search. Set `"boundaries": false`
 * for a pattern that must end on punctuation.
 */
export function compilePattern(pattern) {
  if (!pattern.id) throw new Error("a pattern has no id");
  if (!pattern.match) throw new Error(`pattern ${pattern.id} has no match`);
  if (!Array.isArray(pattern.fires) || pattern.fires.length === 0) {
    throw new Error(`pattern ${pattern.id} ships no "fires" example, so nothing proves it works`);
  }
  const body = pattern.boundaries === false ? pattern.match : `\\b(?:${pattern.match})\\b`;
  return {
    ...pattern,
    rule: pattern.rule ?? "no-empty-metaphor",
    regex: new RegExp(body, "i"),
    guard: (pattern.unless ?? []).map((word) => new RegExp(`\\b${word}\\b`, "i")),
  };
}

/** Publication checks use original bytes, including URLs, tables, comments and code. */
export function checkPublicationResidue(text, filePath, vocab) {
  const rule = vocab.rule("no-publication-residue");
  const checks = [
    ["citation-handle", /\boaicite\b|\[cite(?::|_)|\bturn\d+(?:search|view|news)\d+\b/gi],
    ["placeholder", /\[(?:insert|placeholder|your)\b[^\]\n]*\]/gi],
    ["tracking-parameter", /[?&](?:utm_[a-z_]+|fbclid|gclid)=[^\s)\]<>"']*/gi],
    ["zero-width", /[\u200b\u200c\u200d\u2060]/g],
  ];
  const findings = [];
  for (const [id, regex] of checks) {
    for (const hit of text.matchAll(regex)) {
      const start = text.lastIndexOf("\n", hit.index - 1) + 1;
      const end = text.indexOf("\n", hit.index);
      const lineText = text.slice(start, end < 0 ? text.length : end);
      // Literal examples and source handles in diagnostics are not publication leaks.
      if (/(?<![/.])\b(?:example|fixture|literal|placeholder syntax|citation handle|test vector)\b(?![./])/i.test(lineText)) continue;
      if (id === "tracking-parameter" && /\b(?:analytics|tracking|campaign|query parameter)\b/i.test(lineText)) continue;
      if (id === "zero-width") {
        const around = ([...text.slice(0, hit.index)].at(-1) ?? "") + ([...text.slice(hit.index + 1)][0] ?? "");
        // Joiners in cursive scripts and emoji sequences carry meaning.
        if (/[\p{Script=Arabic}\p{Script=Devanagari}\p{Extended_Pictographic}]/u.test(around)) continue;
        if (/\b(?:unicode|zero.width|word.joiner|line.break)\b/i.test(lineText)) continue;
      }
      const finding = new Finding(filePath, text.slice(0, hit.index).split("\n").length,
        hit.index - start + 1, rule.severity, rule.id, vocab.message(rule.id, `${id}: publication residue.`), hit[0]);
      finding.pattern = id;
      findings.push(finding);
    }
  }
  return findings;
}

const WORDS = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const words = (text) => text.match(WORDS) ?? [];
const LABEL = /^[A-Z][\w /()-]{0,40}:\s/;
const SERIES = /\b[\w'’-]+(?:\s+[\w'’-]+){0,3},\s+[\w'’-]+(?:\s+[\w'’-]+){0,3},?\s+(?:and|or)\s+[\w'’-]+/gi;
const STOP = new Set("a an the and or of to in on for with from that this these those each code will would could should must because after before about their there only also".split(" "));
const contentWords = (text) => new Set(words(text).map((w) => w.toLowerCase()).filter((w) => w.length >= 4 && !STOP.has(w)));

/** Advisory thresholds adapted from the model scanner; never quality scores. */
export function checkParagraphs(text, filePath, vocab, stripNonProse, splitSentences) {
  const rule = vocab.rule("review-paragraph-rhythm");
  const parts = [];
  let current;
  stripNonProse(text).split("\n").forEach((line, index) => {
    if (!line.trim()) { current = undefined; return; }
    const heading = /^\s*(#{1,6})\s+/.exec(line);
    const kind = heading ? "heading" : /^\s*(?:[-*+]|\d+[.)])\s+/.test(line) ? "list" : "paragraph";
    if (kind === "heading" || !current || current.kind !== kind) {
      current = { kind, line: index + 1, text: "", level: heading?.[1].length ?? 0 };
      parts.push(current);
    }
    current.text += " " + line.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s+/, "").trim();
  });
  const findings = [];
  const add = (part, id) => {
    const f = new Finding(filePath, part.line, 1, rule.severity, rule.id,
      vocab.message(rule.id, `${id}: review rhythm and whether repetition serves the reader.`), part.text.trim());
    f.pattern = id;
    findings.push(f);
  };
  const paragraphs = parts.filter((p) => p.kind === "paragraph");
  for (const p of paragraphs) {
    let run = 0;
    let reported = false;
    for (const sentence of splitSentences(p.text)) {
      run = words(sentence.text).length <= 4 && !LABEL.test(sentence.text) ? run + 1 : 0;
      if (run === 3 && !reported) { add(p, "short-sentence-run"); reported = true; }
    }
    if ([...p.text.matchAll(SERIES)].length >= 3) add(p, "repeated-triads");
  }
  let run = [];
  const opener = (p) => {
    const first = words(p.text)[0]?.toLowerCase() ?? "";
    return /^(?:the|a|an)$/.test(first) ? "" : first;
  };
  for (const p of [...paragraphs, null]) {
    if (p && opener(p) && run.length && opener(p) === opener(run[0])) run.push(p);
    else {
      if (run.length >= 3) add(run[0], "repeated-opener");
      run = p && opener(p) ? [p] : [];
    }
  }
  const closings = new Map();
  let last;
  for (const p of [...parts, { kind: "heading", level: 1 }]) {
    if (p.kind === "heading" && p.level <= 2) {
      if (last) {
        const sentence = splitSentences(last.text).at(-1)?.text ?? "";
        const ws = words(sentence);
        if (ws.length >= 2 && !LABEL.test(sentence)) {
          const key = ws.slice(0, 2).join(" ").toLowerCase();
          closings.set(key, [...(closings.get(key) ?? []), last]);
        }
      }
      last = undefined;
    } else if (p.kind === "paragraph") last = p;
  }
  for (const matches of closings.values()) if (matches.length >= 3) add(matches[0], "repeated-ending");
  for (let i = 1; i < parts.length; i++) {
    const a = parts[i - 1], b = parts[i];
    if (new Set([a.kind, b.kind]).size !== 2 || ![a.kind, b.kind].includes("list") || ![a.kind, b.kind].includes("paragraph")) continue;
    const wa = contentWords(a.text), wb = contentWords(b.text);
    const smaller = Math.min(wa.size, wb.size);
    if (smaller >= 6 && [...wa].filter((w) => wb.has(w)).length / smaller >= 0.6) add(b, "adjacent-list-echo");
  }
  return findings;
}

/** Explicit project policy; no automatic discovery or changes to shipped defaults. */
export function loadPolicy(policyPath) {
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
  if (!Array.isArray(policy.patterns)) throw new Error("policy must contain a patterns array");
  const ids = new Set();
  const patterns = policy.patterns.map((pattern) => {
    if (![undefined, "raw", "prose"].includes(pattern.scope)) throw new Error(`policy ${pattern.id}: unknown scope`);
    if (![undefined, "error", "warning", "info"].includes(pattern.severity)) throw new Error(`policy ${pattern.id}: unknown severity`);
    if (ids.has(pattern.id)) throw new Error(`policy: duplicate pattern ${pattern.id}`);
    ids.add(pattern.id);
    return compilePattern(pattern);
  });
  return { patterns };
}

export function checkPolicy(text, filePath, policy, stripNonProse) {
  const findings = [];
  const prose = stripNonProse(text);
  for (const pattern of policy?.patterns ?? []) {
    const source = pattern.scope === "raw" ? text : prose;
    for (const hit of source.matchAll(new RegExp(pattern.regex.source, "gi"))) {
      const start = source.lastIndexOf("\n", hit.index - 1) + 1;
      const end = source.indexOf("\n", hit.index);
      const line = source.slice(start, end < 0 ? source.length : end);
      if (pattern.guard.some((guard) => guard.test(line))) continue;
      if (pattern.scope !== "raw" && ([...line.matchAll(/"[^"]*"|“[^”]*”/g)].some((q) => hit.index - start >= q.index && hit.index - start < q.index + q[0].length))) continue;
      const f = new Finding(filePath, source.slice(0, hit.index).split("\n").length, hit.index - start + 1,
        pattern.severity ?? "info", "local-prose-policy", `Do: ${pattern.instead ?? "follow the owner's prose policy"}. Never: treat a preference as authorship evidence.`, hit[0]);
      f.pattern = pattern.id;
      findings.push(f);
    }
  }
  return findings;
}

