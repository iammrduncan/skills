import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const plugin = path.join(repo, "skills/general/anti-slop/scripts/oxlint");
const oxlint = path.join(repo, "tests/node_modules/.bin/oxlint");

function lint(rule: string, code: string): number[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "upstream-anti-slop-"));
  try {
    // A portable copy must run without depending on this checkout's paths.
    fs.cpSync(plugin, path.join(root, "plugin"), { recursive: true });
    fs.writeFileSync(path.join(root, ".oxlintrc.json"), JSON.stringify({
      categories: { correctness: "off" }, jsPlugins: ["./plugin/index.mjs"], rules: { [`anti-slop/${rule}`]: "error" },
    }));
    fs.writeFileSync(path.join(root, "case.ts"), code);
    const result = spawnSync(oxlint, ["--format", "json", "case.ts"], { cwd: root, encoding: "utf8" });
    assert.ifError(result.error);
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    const output = JSON.parse(result.stdout);
    const diagnostics = output.diagnostics as Array<{
      code: string; labels: Array<{ span: { line: number } }>;
    }>;
    assert.ok(Array.isArray(diagnostics), result.stdout);
    for (const diagnostic of diagnostics) assert.equal(diagnostic.code, `anti-slop(${rule})`);
    return diagnostics.map((diagnostic) => diagnostic.labels[0]!.span.line).sort((a, b) => a - b);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const cases: Array<[string, string, number[]]> = [
  ["no-unknown-parameters", `function isText(value: unknown): value is string { return true; }
function enrich(cause: unknown) {}
function unchecked(cause: any) {}
function wrong(value: unknown, other: unknown): value is string { return true; }
type Handler = (input: unknown) => void;
class Example { constructor(public input: unknown) {} }
function rest(...items: unknown) {}
`, [3, 4, 5, 6, 7]],
  ["no-object-parameters", `type Broad = object;
type Identity<T = Broad> = T;
function bad(input: Identity) {}
function outer<Broad>(input: Broad) {}
function nested() { type Broad = { id: string }; function ok(input: Broad) {} }
type Recursive = Recursive;
function cycle(input: Recursive) {}
interface Contract { (input: object): void; new(input: object): Contract; method(input: object): void }
`, [3, 8, 8, 8]],
  ["no-unknown-returns", `type Identity<T = unknown> = T;
declare function bad(): Promise<Identity>;
type Callback = () => PromiseLike<any>;
function fine<Identity>(): Identity { throw new Error(); }
function local() { type Promise<T> = { value: T }; function ok(): Promise<unknown> { throw new Error(); } }
`, [2, 3]],
  ["no-unknown-type-aliases", `type Root = unknown;
type Indirect = Root;
type Identity<T> = T;
type Applied = Identity<any>;
type Recursive = Recursive;
type Constrained = unknown & { id: string };
function local<Root>() { type Fine = Root; }
type Absorbed = string | unknown;
`, [1, 2, 4, 8]],
  ["no-unsafe-dictionary-type", `type Key = string | 'id';
type Value = unknown;
type Bad = Record<Key, Value>;
type Constrained = Record<string, unknown & { id: string }>;
type BadIntersection = Record<string, any & { id: string }>;
function local() { type Record<K, V> = { value: V }; type Fine = Record<string, unknown>; }
function generic<PropertyKey>() { type Fine = Record<PropertyKey, unknown>; }
type Finite = Record<'id', unknown>;
interface Bag { [key: Key]: string | Value }
type Mixed<T> = T & { id: string };
type GenericAny = Record<string, Mixed<any>>;
type GenericUnknown = Record<string, Mixed<unknown>>;
`, [3, 5, 9, 11]],
  ["no-runtime-typeof", `if (typeof window === 'undefined') {}
if ('undefined' != typeof Worker) {}
if (typeof input === 'string') {}
`, [3]],
  ["require-safety-comment-for-type-assertion", `// The validator checked this payload before use.
export const multiline = (
  input as User
);
const unrelated = 1; // A long unrelated explanatory comment.
const missing = input as User;
const trailing = input as User; // This comment arrives after the assertion.
const angle = <User>input;
// The validator checked this payload before use.
const fine = <User>input;
const mode = 'fast' as const;
const prior = 1 // This explains only the prior value.
const missingAfterAsi = input as User;
const inline = {} /* The parser checked this complete user. */ as User;
`, [6, 7, 8, 13]],
  ["no-known-value-widening", `const bad: unknown = ({ id: 1 } satisfies User);
const angle: any = <User>{ id: 1 };
const fine: User = { id: 1 };
`, [1, 2]],
];
for (const [rule, code, expected] of cases) {
  it(`${rule}: upstream regressions report exact locations in a portable copy`, () => {
    assert.deepEqual(lint(rule, code), expected);
  });
}

// Each shipped failing case has an independently specified diagnostic location.
const fixtureLines: Record<string, number[]> = {
  "no-known-value-widening": [1, 2, 3, 4, 5],
  "no-object-parameters": [1, 1, 2, 3, 4, 5, 6],
  "no-unknown-parameters": [1, 2, 3, 4, 5, 6],
  "no-unknown-returns": [1, 2, 3, 4, 5],
  "no-unknown-type-aliases": [1, 2, 3, 4, 5],
  "no-unsafe-dictionary-type": [1, 2, 3, 4, 5],
  "require-safety-comment-for-type-assertion": [1, 2, 3, 4],
};
for (const [rule, lines] of Object.entries(fixtureLines)) {
  it(`${rule}: every shipped failing fixture reports at its expected location`, () => {
    assert.deepEqual(lint(rule, fs.readFileSync(path.join(plugin, "fixtures", `${rule}.fires.ts`), "utf8")), lines);
  });
  it(`${rule}: shipped boundary fixtures stay quiet`, () => {
    assert.deepEqual(lint(rule, fs.readFileSync(path.join(plugin, "fixtures", `${rule}.passes.ts`), "utf8")), []);
  });
}
