# Skills repository instructions

These instructions apply to this repository and all its child folders.

This repository holds portable agent skills. It holds no application source code. A skill in this
repository must work in any repository that installs it.

## Agent note

- never use coauthored tags for claude or codex or whatever agent you are.
- read @skills/general/engineering/reference/GOOD_ENGINEERING_H.md for good practices

## Skill layout

Skills are grouped by category. General-purpose skills live under `skills/general/`. The leaf
directory name is the skill name.

| Path | Required | Purpose |
| --- | --- | --- |
| `skills/<category>/<name>/SKILL.md` | Yes | The skill. YAML frontmatter, then the instructions. |
| `skills/<category>/<name>/agents/openai.yaml` | No | Display metadata for Codex and other OpenAI agents. |
| `skills/<category>/<name>/reference/` | No | Playbooks and reference files the skill loads on demand. |
| `skills/<category>/<name>/scripts/` | No | Executables and their data files. |
| `skills/<category>/<name>/NOTICE.md` | No | Third-party attribution, when the skill carries other people's material. |

## Skills with more than one job

A skill that covers several distinct jobs takes a sub-command instead of splitting into several
skills. One skill means one description for the agent to route on, and one place to keep the shared
rules.

`SKILL.md` stays a router. It holds:

1. the invariants that apply to every command;
2. shared setup, including how to resolve the skill's own directory;
3. a command table, one row for each command, linking to its playbook;
4. routing rules — what to do for an explicit command, for a bare target, and for neither.

Each command owns one file under `reference/`, named for the command. Put the procedure there, not
in `SKILL.md`. The agent loads one playbook, not all of them.

Rules:

- Make the default command the one that cannot damage the target. Route a bare target to the
  read-only command and offer the writing command afterward.
- State in each playbook whether the command writes files.
- Do not let a read-only command apply changes because the changes look obvious.

`simplified-technical-english` is the worked example.

## Scripts

A script in `scripts/` must run from a copy of the skill directory with no install step. Resolve
data files relative to the script, not to the working directory. Keep the working directory at the
user's project.

State the interpreter and any version floor in the playbook that calls the script. Say what to do
when the interpreter is absent: report the gap. Do not silently substitute the agent's judgement for
a tool the skill exists to run.

## Frontmatter

`SKILL.md` must start with YAML frontmatter that has a `name` and a `description`.

```markdown
---
name: write-adrs
description: What the skill does and when an agent must use it.
---
```

Rules:

- Make `name` lowercase, use hyphens, and match the directory name.
- Name the task, not its category. Start with a verb when a verb reads naturally. Examples:
  `write-adrs`, `write-docs`, `anti-slop`.
- Write `description` for routing. State the task and the trigger. An agent reads this line to
  decide whether to load the skill.
- Set `metadata.internal: true` while a skill is a stub or is not ready to ship.

## Categories

`general` holds working practices that can be installed in any repository. The category belongs in
the path, not in the skill name. `skills/general/write-adrs/` therefore declares `name: write-adrs`.

Classify by what the skill teaches, not by words in its subject. `brometal-patching` belongs under
`general/` because dependency patching is a portable working practice. A new category needs a human
owner's decision and a matching entry in [`README.md`](README.md).

## Writing rules

- Keep the skill short. Put long reference material in `reference/` and link to it.
- Give the agent a procedure, a boundary, and a verification step.
- Do not embed version-sensitive API details. Tell the agent to read the current documentation and
  the installed types in the target project.
- Do not depend on paths that exist only in one particular repository.
- Use active voice and short sentences.

## Verification

Before you commit a skill change:

- Run `npx skills add . --list` and confirm the skill appears with the expected name.
- Confirm the frontmatter is valid YAML.
- Confirm all local links resolve.
- A skill that ships a script must ship tests for it, under `tests/unit/`.
- Run the harness self-test and the deterministic eval:

  ```bash
  cd tests && npm test          # typecheck, self-test, then the eval
  ```

- Run `git diff --check`.

A passing script test says the tool works. It says nothing about whether the agent loads the skill
when it should, or follows the playbook once loaded. That is what `tests/eval/` measures, and a
change to a skill's behaviour should be validated with a paired live run:

```bash
cd tests && npm run test:skill-behavior:paired
```

Run `npm run test:sandbox` before trusting any eval result. A green suite means nothing unless the
assertions have been shown capable of failing.

A skill's eval lives at `tests/eval/suites/<skill-name>/`, holding both its `cases/` and its
`fixtures/`. The directory is named exactly for the skill, so a skill and everything that measures
it stay together.

## Release authorization

When the owner asks to cut or publish a release, that request authorizes the repository's release
script to run its configured live eval, send the eval prompts and fixtures to the configured model
provider, commit the generated release report and version, create the release tag, and push `main`
and the tag to `origin`. Do not ask for separate approval for those release steps.
