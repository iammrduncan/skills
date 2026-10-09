# Select and adapt convention sources

Read-only source selection. Writing the resulting conventions belongs to
[generate-agent-instructions](generate-agent-instructions.md) after an explicit writing request.
Load this guide when building conventions from style guides or helping an owner choose them.

## Source menu

| Source | Use | Adaptation boundary |
| --- | --- | --- |
| Existing project instructions, style guides, code and CI | Establish authority and actual practice | Preserve nested exceptions; distinguish policy from incidental habits |
| [Good Engineering](GOOD_ENGINEERING_H.md) | Complexity, interfaces, testing, security and resource reasoning | Retain the owner's decisions when a general principle conflicts |
| [The ladder](ladder.md) | Choose the least complex adequate approach after understanding the problem | Preserve an existing shortcut marker; do not rename it |
| [TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) | Explicit invariants, resource budgets and failure reasoning | Allocation bans, Zig tooling, size caps and assertion quotas require project justification |

The fxClaw example combines these kinds of sources into short agent instructions linked to detailed
conventions. Its local style paths are evidence about that project, not dependencies of this skill.

## Walk the owner through decisions

1. Discover the project's authoritative sources and inspect representative code, tests and CI first.
   Read the bundled principles and ladder when selected. Retrieve the current official external
   source when selected, record its revision or retrieval date, and inspect the relevant sections.
   If retrieval is unavailable, report the gap; do not reconstruct a source from memory.
2. Present a compact comparison of applicable rules: source, project evidence, benefit, conflict,
   and proposed adaptation. Recommend sources and choices supported by the project. Ask only about
   unresolved policy choices, such as whether to introduce a resource budget or a new size threshold.
   Continue work that does not depend on those answers. Do not treat silence as adoption of a mandate.
3. Translate accepted ideas into project-specific obligations. For example, a queue rule names its
   capacity, overflow behavior, owning configuration and boundary test. A style rule names the real
   formatter command and scope, or labels itself review-only when no gate exists.
4. Keep a source-to-rule map with accepted, rejected and deferred decisions. Preserve stable IDs.
   Explain material exceptions, including dynamic allocation or platform-specific interfaces.
   Link AGENTS.md to the actual conventions destination. Put rationale beside detailed rules rather
   than duplicating it in every agent file; delegates import the appropriate AGENTS.md.

Verify each resulting claim against project evidence and each link from its containing file.
Selected source guidance is not evidence that a project enforces it. Report unavailable sources and
unresolved choices separately from completed output. Do not install tools or modify CI to make a
borrowed guide appear enforced.
