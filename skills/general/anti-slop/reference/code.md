# `code` — the Oxlint rules

Read-only. Run the project's existing Oxlint executable; the rules live inside it.
Do not install a linter during review. If Oxlint or its required Node interpreter is absent,
report the gap. Consult installed types and current documentation when interpreting rule behavior.

```bash
./node_modules/.bin/oxlint                       # whatever the project's config covers
./node_modules/.bin/oxlint src/ --format=json
```

If the plugin is not installed yet, that is [`install`](install.md).

## The five evidence rules

### `no-tautological-assertion`

An assertion whose outcome is fixed before it runs.

Catches `expect(A).toBe(A)` and the other self-comparing matchers, `expect(<constant>).toBeTruthy()`,
`assert.ok(true)`, `assert(true)`, and `assert.equal(A, A)`. Comparison is on normalised source text,
so `expect(user.name).toEqual(user.name)` is caught and `expect(a.b).toBe(c.d)` is not.

This is the purest evidence theatre: it runs, it passes, coverage counts it, and no behaviour was
checked. Agents write these when asked to add a test for code they cannot exercise.

*False positive:* a deliberate identity test — checking that a normaliser leaves already-normal input
alone. Written as `expect(normalise(x)).toBe(x)` it does not fire, because the two sides differ.
Written as `expect(x).toBe(x)` it says nothing anyway.

### `no-disabled-test`

A test committed switched off: `it.skip`, `test.todo`, `describe.only`, `xit`, `fdescribe`.

`.only` gets a harsher message than `.skip`, because it is a worse defect. `.skip` removes one test;
`.only` **silently disables every other test in the run**, so a green suite can mean one assertion
passed. Both survive review because the diff is one character.

*False positive:* a suite deliberately parked behind a skip with an issue reference. The rule has no
way to see the issue. If a project wants that, the answer is a runner-level exclusion, which is
visible in config rather than buried in a file.

### `no-swallowed-error`

Two shapes:

- an **empty catch block** — the failure leaves no trace anywhere;
- a catch that **binds the error and never uses it**, and does not rethrow.

The second is the precise one. Binding the error means the author meant to use it, so a binding that
is never referenced is evidence discarded on purpose with no note left.

`catch { return fallback }` with no binding is deliberately left alone. That is a readable fallback,
not a swallowed error, and flagging it would push people toward the empty-binding form this rule
exists to catch.

### `no-placeholder-body`

A function whose entire body throws a placeholder: `Not implemented`, `TODO`, `stub`, `placeholder`,
`coming soon`.

An agent asked for six things will sometimes build four and stub two. The stubs are syntactically
complete, they type-check, and they read as finished at a glance. This makes the stub visible at the
same moment as the work.

*Deliberately not caught:* an abstract method that throws to tell a subclass what to provide, as long
as the message says that rather than "not implemented". The vocabulary is the whole discriminator.

### `require-suppression-reason`

`@ts-expect-error`, `@ts-ignore`, `eslint-disable*`, `oxlint-disable*`, `biome-ignore`, `c8 ignore`
and friends, with fewer than three words of explanation.

A suppression is a claim that the checker is wrong. Unaccompanied, it is a claim with no evidence —
the same defect [`prose.md`](prose.md) catches in sentences. It is also the cheapest escape hatch an
agent has, which is why it should cost one sentence.

The rule follows the conventional `-- reason` separator after a rule list, so
`// eslint-disable-next-line no-console -- this is the CLI banner` passes and
`// eslint-disable-next-line no-console` does not.

**This rule never forbids suppressing.** Blocking the escape hatch outright makes an agent route
around the checker instead of the problem. Requiring the reason keeps the hatch and makes each use
reviewable.

## The fifteen adapted TypeScript rules

The plugin also checks assertion chains, unknown/any returns and parameters, unknown aliases,
unsafe dictionary values, known-value widening, widening followed by assertion, ad hoc runtime
`typeof`, object parameters, module mocks, Reflect apply/get, empty-object conditional spreads,
shape-named symbols and assertions without safety comments.

Read the installed rule and its passing fixtures when a technical use looks legitimate. Examples
include declared type predicates, `typeof` undefined probes, constrained dictionaries and explicit
safety invariants. Alias/default type resolution is bounded by the installed implementation.
These checks identify selected type patterns; they do not replace the TypeScript compiler or
establish complete type safety. Fixtures and rule exports are the current inventory.

## Verifying the plugin actually loaded

A plugin that fails to load reports nothing and exits 0 — indistinguishable from a clean run. Lint a
shipped fixture to prove otherwise:

```bash
./node_modules/.bin/oxlint tools/anti-slop/fixtures/no-tautological-assertion.fires.ts
```

Every rule ships `<rule>.fires.ts` and `<rule>.passes.ts`. The first must produce findings and the
second must produce none.

## Manual evidence pass

Inspect whether assertions exercise behavior and whether expected values follow independently
from a specification, hand calculation or reference. A test comparing implementation output
against a copied version of the same calculation can pass while both are wrong. Where warranted,
break behavior in an isolated copy and verify the test catches it; discard the mutation afterward.
Run examples using declared dependencies and compare printed output with actual output. Resolve
imports, commands and paths; report missing requirements. Attribute measurements to their source
and separate observed results, calculated estimates and publisher reports. Record revision,
command and environment. Report what you ran and what you inspected separately.

## Context and resource review

Read the surrounding module and callers alongside the diff. Flag comments that merely narrate
operations, new wrappers that add no useful boundary, duplicate canonical helpers, and special-case
branches that increase the state a reader must track. Explain the concrete cost; local style alone
is not proof of a defect. Preserve rationale comments and documented exceptions.

For an apparently redundant guard, trace the runtime validation and possible callers first.
A TypeScript annotation or non-null assertion does not validate external input. Preserve boundary
checks and invariant assertions unless evidence establishes that they are redundant.

Check queue/retry limits and overflow behavior, state ownership and cleanup, and failures between
related updates. Compare boundary tests with the declared contract. Report missing evidence rather
than claiming the linter checks these properties. Review stays read-only; suggest focused remedies.
A clean score, reduced line count or removed suppression does not establish preserved behavior.

## What this does not check

Complete type safety. Complexity, duplication, and dead exports — `eslint-plugin-sonarjs`, `jscpd`, `knip`. Whether a test asserts the
*right* thing requires independent reasoning; mutation testing can supply additional evidence. Say so when reporting.
