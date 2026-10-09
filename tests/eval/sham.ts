/**
 * The sham arm: same catalog, generic bodies.
 *
 * with-skill vs no-skill measures whether the *catalog entry* helped. It cannot
 * tell you whether your *content* helped, because both differences move at once:
 * the no-skill arm has no description to match on, no document to open, and no
 * guidance inside it. A lift is consistent with the skill being excellent and
 * equally consistent with the model doing better whenever it is handed any page
 * of competent-sounding advice.
 *
 * Ponytail runs a third arm for this — `caveman`, an unrelated published skill —
 * and their comprehension study sharpens it further: a plain-prose version of
 * their own rule scored 0/3 where the operational wording scored 6/6. That gap
 * is the thing worth measuring, and it is invisible with two arms.
 *
 * This arm holds everything constant except the body. Frontmatter is copied
 * **verbatim** from the real skill, so the catalog the model sees is identical:
 * same names, same descriptions, same count, same trigger surface. Only the text
 * behind the door changes, to generic advice on the same subject.
 *
 * Read the result as:
 *   with − sham    the value of what we wrote
 *   sham − without the value of there being a document at all
 *
 * The bodies are generated into a temp dir at run time and bind-mounted over
 * /skills rather than committed, so a sham can never drift from the frontmatter
 * it is supposed to mirror.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(HERE, "../../skills");

/**
 * Generic advice, one entry per skill.
 *
 * The standard each of these has to meet: a competent generalist could have
 * written it without ever seeing our repository, and following it would not tell
 * you the one thing the real skill exists to say. No paths, no numbering rules,
 * no ownership suffixes, no named procedures, no commands.
 *
 * They are deliberately not strawmen. A sham that is obviously useless measures
 * nothing — the arm only bounds the catalog effect if the model that opens one
 * comes away feeling helped.
 */
const GENERIC_BODIES: Record<string, string> = {
  "anti-slop": `# Keeping a repository tidy

A repository accumulates files nobody meant to keep. Left alone, the accumulation becomes the
norm, and nobody can tell which files still matter.

- Put a test where the project's test runner will find it. A test nothing runs is not a test.
- Delete a script once the job it did is finished, or write down when someone should run it.
- When a directory fills with files whose names share a prefix, the prefix is asking for a folder.
- Review a new file as carefully as a new dependency. A file is a commitment to maintain it.

The same discipline applies to what a document asserts. Saying that something is fast, robust, or
maintainable tells a reader nothing on its own. Give the number, the measurement, or the record
that settled it, or leave the claim out.`,

  "simplified-technical-english": `# Writing clearly for technical readers

Technical prose is read under pressure by people who are looking for one thing. Write so that
they find it.

- Prefer short sentences. One idea per sentence.
- Use the active voice and name the actor.
- Choose the plain word over the impressive one.
- Keep terminology consistent: the same thing keeps the same name throughout.
- Cut hedging, throat-clearing, and words that carry no information.
- Put the instruction before the explanation, so a reader who already understands can stop.

Read the draft back and ask whether a tired reader would get it right the first time. If a
sentence needs a second pass, rewrite it rather than adding a clarification.`,

  "write-adrs": `# Recording architectural decisions

A decision record captures a choice that was hard to make and would otherwise be re-litigated.
Write it so a reader arriving in a year understands what was chosen and why.

- Say what the decision is, plainly, near the top.
- Give enough background that the constraints are visible.
- Note the alternatives considered, briefly.
- Be honest about the costs; a record with no downside listed is advocacy.
- Keep it short. A page a reader finishes beats three pages they skim.

Decisions age. Note when one is no longer current rather than quietly editing history.`,

  "write-objectives": `# Planning larger work

Work that does not fit in one change needs a plan that survives contact with the work.

- State the outcome, and how you will know it was reached.
- Break the work into pieces that can be finished and checked independently.
- Order them so that each one leaves the project in a working state.
- Keep the plan current as the work teaches you things; a stale plan is worse than none.
- Write down what was decided as you go, so the reasoning is not lost.

When a piece grows past its estimate, say so rather than quietly widening it.`,

  "brometal-patching": `# Working with dependency defects

Sometimes the bug is not in your code. Handle that carefully.

- Reproduce the defect in isolation before concluding it is upstream.
- Check whether it is already known, and already fixed.
- Prefer the smallest local workaround that unblocks you.
- Record why the workaround exists and what would let you remove it.
- Report the problem upstream with a minimal reproduction.

A local change that nobody can explain later is a liability. Leave a trail.`,

  "write-docs": `# Writing documentation

Good documentation serves a specific reader with a specific need.

- Decide who the page is for before you write a word of it.
- Lead with what the reader is trying to do, not with how the system is built.
- Use examples the reader can adapt.
- Keep one page to one job. A page that serves everyone serves no one well.
- Test the instructions by following them exactly as written.

Review documentation the way you review code: read it as the person who has to use it.`,

  "engineering": `# Engineering judgement

Before building something, think about whether it should exist.

- Understand the problem before proposing a solution.
- Prefer the simplest approach that could work.
- Reuse what is already there before writing something new.
- Be explicit about what you do not know.
- Say when you disagree, with a reason.

Review is most valuable when it is honest. Agreeing to be agreeable helps nobody.`,

  "show-me": `# Explaining visually

A visual explanation should make the central relationship easy to find.

- Decide what the reader needs to understand.
- Include only the labels and relationships that support that point.
- Put related things near each other.
- Use consistent direction, spacing, and terminology.
- Add a short explanation when the visual cannot stand alone.

Review the result at the size where the reader will use it. Remove anything that competes with the
main idea.`,

  "wait-what": `# Catching up

When you have lost the thread, stop and re-establish it before continuing.

- Say plainly what you understand and what you do not.
- Re-read the relevant material rather than reconstructing it from memory.
- Ask about the parts that are genuinely ambiguous.
- Summarise back before acting on the answer.

Guessing forward from a shaky understanding costs more than the pause would have.`,
};

/** Frontmatter block, verbatim, including the delimiters. */
function frontmatter(skillMd: string): string {
  if (!skillMd.startsWith("---")) throw new Error("SKILL.md has no frontmatter");
  const end = skillMd.indexOf("\n---", 3);
  if (end === -1) throw new Error("SKILL.md frontmatter is unterminated");
  return skillMd.slice(0, end + 4);
}

interface SkillEntry {
  name: string;
  dir: string;
  relativeDir: string;
}

function skillEntries(dir = SKILLS_DIR): SkillEntry[] {
  const entries: SkillEntry[] = [];
  for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    const childDir = path.join(dir, child.name);
    if (fs.existsSync(path.join(childDir, "SKILL.md"))) {
      entries.push({
        name: child.name,
        dir: childDir,
        relativeDir: path.relative(SKILLS_DIR, childDir),
      });
    } else {
      entries.push(...skillEntries(childDir));
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function skillNames(): string[] {
  return skillEntries().map((entry) => entry.name);
}

export function skillPath(name: string): string {
  const entry = skillEntries().find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`unknown skill: ${name}`);
  return entry.dir;
}

/**
 * Build the sham tree and return its path.
 *
 * Throws on a skill with no generic body rather than silently shipping an arm
 * with a hole in it: a missing sham is a skill whose lift stays unattributed,
 * and finding that out from a quiet gap in a report is worse than a build error.
 */
export function buildShamSkills(into?: string): string {
  const root = into ?? fs.mkdtempSync(path.join(os.tmpdir(), "skills-sham-"));
  const missing: string[] = [];

  for (const entry of skillEntries()) {
    const { name } = entry;
    const body = GENERIC_BODIES[name];
    if (!body) {
      missing.push(name);
      continue;
    }
    const real = fs.readFileSync(path.join(entry.dir, "SKILL.md"), "utf-8");
    const dir = path.join(root, entry.relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `${frontmatter(real)}\n${body}\n`);
  }

  if (missing.length) {
    throw new Error(
      `sham arm has no generic body for: ${missing.join(", ")}.\n` +
        "Add one to GENERIC_BODIES in tests/eval/sham.ts. The sham arm must cover every skill or " +
        "the catalog it presents is not the one the with-skill arm presents.",
    );
  }
  return root;
}
