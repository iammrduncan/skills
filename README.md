# iamMrDuncan agent skills

Portable ways of working for coding agents. Each skill works independently of this repository.

Each leaf directory under [`skills/`](skills/) is an independently installable agent skill. Skills
follow the [Agent Skills specification](https://agentskills.io) and install with the open
[`skills` CLI](https://github.com/vercel-labs/skills).

## Install

```bash
# List the skills in this repository
npx skills add iammrduncan/skills --list

# Install one skill
npx skills add iammrduncan/skills --skill write-adrs

# Install several skills for a specific agent
npx skills add iammrduncan/skills -a claude-code --skill write-adrs --skill write-objectives

# Install everything
npx skills add iammrduncan/skills --all
```

Add `-g` to install to your user directory instead of the current project.

## Use without installing

```bash
npx skills use iammrduncan/skills@write-adrs | claude
```

## Categories

Skills are grouped by category without carrying that category in their names.

| Directory | Domain |
| --- | --- |
| `skills/general/` | Working practices portable to any repository. |

## Skills

| Skill | Status | Purpose |
| --- | --- | --- |
| [`write-adrs`](skills/general/write-adrs/) | Ready | Write and propose Architecture Decision Records. |
| [`write-objectives`](skills/general/write-objectives/) | Ready | Run objectives end to end: scaffold, research, plan, goals, execute, audit, archive. |
| [`brometal-patching`](skills/general/brometal-patching/) | Ready | Consume BroMetal as a patched dependency and upstream the fixes. |
| [`simplified-technical-english`](skills/general/simplified-technical-english/) | Ready | Write, audit, and fix text against ASD-STE100 Issue 9. Carries a deterministic linter and the controlled vocabulary. |
| [`write-docs`](skills/general/write-docs/) | Ready | Write and audit user-facing documentation with Diátaxis. Covers each page type and the way it fails. |
| [`show-me`](skills/general/show-me/) | Ready | Explain the current topic with the smallest useful visual: a diagram, code-shape sketch, diff, or focused HTML artifact. |
| [`engineering`](skills/general/engineering/) | Ready | Engineering judgment plus evidence-based auditing and generation of repository agent instructions. |
| [`anti-slop`](skills/general/anti-slop/) | Ready | Reject what looks like evidence and is not: tests that cannot fail, discarded errors, stubs, orphan scripts, claims with no referent. Ships a twenty-rule Oxlint plugin and two Node-only linters. |
| [`wait-what`](skills/general/wait-what/) | Ready | Re-pitch something that did not land. Human-invoked only — it stays out of the model's catalog. |

Stub skills contain frontmatter only. They are placeholders and do not yet give an agent useful
instructions.

### Sub-commands

A skill that covers more than one job routes through a sub-command. `SKILL.md` holds the command
table; each command has its own playbook under `reference/`.

```
/simplified-technical-english audit docs/adr/framework/0021-*.md
/simplified-technical-english fix README.md
/simplified-technical-english write
```

| Skill | Commands |
| --- | --- |
| `simplified-technical-english` | `write`, `audit`, `fix` |
| `write-adrs` | `write`, `suggest` |
| `brometal-patching` | `update`, `patch`, `pr` |
| `write-objectives` | `init`, `create-research`, `create-plan`, `create-goals`, `execute`, `audit`, `complete-goal`, `complete-objective` |
| `write-docs` | `classify`, `write`, `audit`, `split` |
| `engineering` | `gut-check`, `talk-it-out`, `plan-it`, `grill-it`, `audit-agent-instructions`, `generate-agent-instructions` |
| `anti-slop` | `install`, `code`, `prose`, `structure` |
| `wait-what` | *(bare)*, `init` |

## Repository layout

```
skills/
  general/
    <skill-name>/
      SKILL.md            # required: YAML frontmatter with name + description, then instructions
      agents/
        openai.yaml       # optional: Codex/OpenAI display metadata
```

The CLI discovers skills in `skills/` up to three directory levels deep.

## Add a skill

```bash
npx skills init skills/general/<skill-name>
```

Then fill in the frontmatter and the body. See [`AGENTS.md`](AGENTS.md) for the authoring rules.

## Hide a work-in-progress skill

Set `metadata.internal: true` in the frontmatter. The CLI then hides the skill unless the installer
sets `INSTALL_INTERNAL_SKILLS=1`.

See [the source record](docs/SOURCES.md) for reviewed upstream revisions and intentional adaptations.

## Third-party notices

`simplified-technical-english` carries the ASD-STE100 controlled vocabulary and a summary of
its rules. ASD-STE100 is the property of ASD and its name is an EU registered trade mark. See
[the skill's notice](skills/general/simplified-technical-english/NOTICE.md) for what is and is not
included, and get the standard itself, free, from <https://www.asd-ste100.org>.

`anti-slop` adapts fifteen TypeScript rules from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) by Dillon Mulroy (MIT, Copyright (c)
2026). Each adapted rule carries the complete upstream MIT license notice at the top of its source
file. The other five Oxlint rules and the two Node checkers do not carry that upstream notice.
