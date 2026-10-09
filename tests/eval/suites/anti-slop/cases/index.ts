/**
 * anti-slop suite — cases for `anti-slop`.
 *
 * Fixtures live in ../fixtures/ and are seeded into
 * /workspace/anti-slop/ before each run.
 *
 * The suite is built around the two ways this skill fails quietly: reporting a
 * clean run as a clean bill of health, and taking the cheap route a rule names
 * in its own `Never:` clause. Both look like success in a transcript.
 */

import { inSuite } from "../../types.ts";
import { TRIGGER_CASES } from "./trigger.ts";
import { AUDIT_CASES } from "./audit.ts";
import { REPORTING_CASES } from "./reporting.ts";
import { PROSE_REVIEW_CASES } from "./prose-review.ts";
import { FIX_CASES } from "./fix.ts";

export const ANTI_SLOP_CASES = inSuite("anti-slop", [
  ...TRIGGER_CASES,
  ...AUDIT_CASES,
  ...REPORTING_CASES,
  ...FIX_CASES,
  ...PROSE_REVIEW_CASES,
]);
