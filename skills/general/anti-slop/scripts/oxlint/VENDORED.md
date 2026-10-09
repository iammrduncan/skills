# Adapted dmmulroy/anti-slop rules

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop).
License: MIT, Copyright (c) 2026 Dillon Mulroy. The complete MIT notice remains
in each adapted rule and copied helper. Keep those notices when distributing copies.

The historical import was pinned to `446268e5d15baa968eaec669ff65358d36ae6259`
(2026-08-14). On 2026-10-08 we inspected all 23 commits through
`c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (2026-09-10), including the
[comparison](https://github.com/dmmulroy/anti-slop/compare/446268e5d15baa968eaec669ff65358d36ae6259...c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b).
This is a selective adaptation, not a verbatim snapshot or an automatic update to every upstream rule.

## Sources and selected changes

Local `rules/<name>.mjs` derives from upstream `src/rules/<name>.ts` for these
fifteen public names:

- `no-chained-type-assertions`
- `no-conditional-empty-object-spread`
- `no-known-value-widening`
- `no-module-mocking`
- `no-object-parameters`
- `no-reflect-apply`
- `no-reflect-get`
- `no-runtime-typeof`
- `no-shape-in-symbol-names`
- `no-unknown-parameters`
- `no-unknown-returns`
- `no-unknown-type-aliases`
- `no-unsafe-dictionary-type`
- `no-widen-then-assert`
- `require-safety-comment-for-type-assertion`

The five other local rules are outside this upstream refresh.

| Upstream source at inspected revision | Local selection |
| --- | --- |
| `src/shared/type-alias-resolution.ts`, `src/shared/lexical-type-parameters.ts` | JavaScript translations under `helpers/`; preserve lexical binding, generic substitution/defaults, shadowing, cycle protection, and per-program caching. A local alternate-matcher callback retains substitutions when checking absorbing `any` intersections. |
| `src/shared/function-parameters.ts` | JavaScript translation under `helpers/`; use wrapped parameter annotations and names. |
| `src/rules/no-unknown-parameters.ts` | Exempt unknown error `cause` and predicate subjects; inspect function types, signatures, overloads, and constructor properties. Local checks also resolve aliases. |
| `src/rules/no-object-parameters.ts`, `no-unknown-returns.ts`, `no-unknown-type-aliases.ts` | Resolve scoped/generic aliases and absorbing unions. Inspect signature contracts and Promise/PromiseLike return values. Do not infer imported types. |
| `src/shared/dictionary-types.ts`, `src/rules/no-unsafe-dictionary-type.ts` | Select alias-aware key/value matching, lexical built-in shadowing, broad key unions, and constrained-intersection handling. |
| `src/rules/no-runtime-typeof.ts` | Allow comparisons against the literal `undefined`, in either operand position. |
| `src/rules/require-safety-comment-for-type-assertion.ts` | Inspect angle-bracket assertions and preceding comments on containing statements/exports, including multiline assertions. Reject trailing comments from another statement. |
| `src/rules/no-known-value-widening.ts`, `src/shared/dictionary-types.ts` | Unwrap satisfies, non-null, and both assertion forms around known initializers. |

## Intentional differences and deferred changes

Keep the existing public names, dependency-free `.mjs` plugin interface, and
`Do:`/`Never:` advice. Top-type rules continue to reject `any` as well as
`unknown`; the predicate/cause exception does not excuse `any`.

Dictionary checks still require broad keys and top-type values. Finite key
records remain allowed. We did not adopt upstream's broader bans on `object`,
empty interfaces, or empty object values, nor its mapped/wrapped dictionary
families. A constrained intersection with `unknown` retains its contract;
`any` absorbs an intersection.

Assertion explanations retain the local minimum of three words. A `SAFETY:`
marker is not required. `as const` and angle-bracket const assertions remain
exempt. Runtime typeof still checks comparisons outside predicate functions,
rather than banning every typeof expression. Shape checks still cover declared
`Shape`/`Shapes` suffixes, so upstream's borrowed-member exception is already
satisfied. Scope-helper refactoring for mocking and Reflect was already present
locally. Existing chained assertions and finite-key widening policies stay intact.

Defer upstream's known-value calls into predicates, broad dictionary/anonymous
object widening, assignment/return/property widening, and new Effect,
performance, and spacing rules. They enlarge local policy beyond these fixes.

## Verification and future refresh

Regression fixtures remain under `fixtures/`. Exact diagnostic locations and
quiet boundary cases run in `tests/unit/upstream-anti-slop.test.ts`, through real
Oxlint with a portable plugin copy. Run from the repository's `tests/` directory:

```sh
node --import tsx --test unit/upstream-anti-slop.test.ts
```

For future updates, compare a fixed upstream revision with this inspected
revision, read the local rule first, and port relevant fixes selectively. Keep
notices and public names. Add both firing and quiet regression cases; verify
exact locations before claiming coverage. The helpers are shipped JavaScript
and require no TypeScript compilation or installation in the user's project.
