# audit-agent-instructions

Read-only. Do not create, edit, move, or delete files, or run commands that rewrite artifacts.

## Procedure

1. Resolve the requested target and its scope. Inventory applicable parent instructions, the target's
   `AGENTS.md`, `CLAUDE.md`, conventions, and nested instruction files. Follow their references,
   including any chosen style sources. Record which directories each rule governs. Inspect ignored
   or private material only when authorized; report unavailable evidence as a limitation.
2. Trace representative code and tests to understand architecture, boundaries, and terminology.
   Inspect manifests, build scripts, formatter/linter configuration, and CI workflow definitions.
   A convention's “CI” label is a claim to verify, not proof. Trace the actual invocation, working
   directory, file coverage, thresholds, and exceptions. Distinguish an enforced gate from a local
   command and from review discipline. A configured test is not evidence of a passing run.
3. Check instructions for stale paths and commands, contradictory rules, redundant copies, scope
   leaks, unsupported architecture or CI claims, and lost owner choices. Include exact file/rule
   locations and the evidence supporting each finding. Do not infer missing policy from silence.
4. Compare selected style principles with the project's needs. Explain what transfers, what needs
   adaptation, and what does not fit. For example, bounded work and negative-case tests may transfer;
   allocation bans, line caps, assertion quotas, or a sans-io design need project-specific evidence
   or an owner decision. Preserve existing shortcut markers and stable rule IDs.
5. Report findings ranked by consequence, affected scope, and a concrete correction proposal.
   Separate observed facts, recommendations, and unresolved owner decisions. If the evidence agrees
   with the instructions, say so; do not manufacture findings. Offer
   `generate-agent-instructions` for authorized corrections without applying them.

## Verification

Resolve every cited local path relative to the document that uses it. Cross-check every command and
“enforced” claim against its implementation and caller. Use harmless checks when useful and available;
report checks not run and why. Do not execute golden-update, install, deployment, or other writing
commands during an audit. Before reporting, confirm the target has no changes attributable to this
command. Include limitations when files, tools, or selected sources are unavailable.
