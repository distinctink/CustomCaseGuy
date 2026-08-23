-- =====================================================================
-- Open the findings from the 2026-08-23 install/troubleshooting pass
-- Project: ai-brain (gmzfqxxgarwtlwxltlzc)
-- Authored 2026-08-23. NOT YET APPLIED.
--
-- Five new core.tasks rows and three appends to existing ones. Every insert is
-- guarded on title so re-running is a no-op.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The catalog naming layer never loaded. This is the largest single gap
--    found in this pass and nothing upstream recorded it.
-- ---------------------------------------------------------------------
INSERT INTO core.tasks (title, details, status, priority, source, written_by)
SELECT
'Catalog naming layer never loaded: display_name NULL on all 14,143 designs',
'FOUND 2026-08-23 by the install/troubleshooting pass. Verified directly against catalog.designs.

  select count(*), count(display_name), count(descriptor), count(breed),
         count(name_source), count(primary_sha256), count(design_family)
  from catalog.designs;
  -> 14143, 0, 0, 0, 0, 13934, 313

The identity spine of the catalog load succeeded: code_canonical is populated on all 14,143 rows, 14,143 distinct, clean 1:1, and primary_sha256 is set on 13,934. The human-readable layer never ran. display_name, descriptor, breed, name_source and name_confidence are NULL on EVERY row, and design_family is set on only 313.

WHY THIS MATTERS MORE THAN IT LOOKS
  1. Task b0869ff8 asks Daren to approve, among other things, "the naming rule display_name = file stem + descriptor with padding preserved". That rule has not been executed on a single row, so approving the structure does not by itself produce named designs.
  2. Gate 12ab7060 (canonical-art-identity) was checked on 2026-08-22 and correctly left unclear, but for a smaller reason than the real one: 209 designs missing a sha. The bigger reason is that there are no names at all. Carol''s design-level sales ranking needs an identity that a human can read in a brief; code_canonical alone is not it.
  3. Anything that joins a marketplace listing to a readable design name currently cannot.

WHAT TO DO
  Re-run the naming stage of the loader from 48_catalog-build_2026-08-21 against the already-loaded rows, or establish why it was skipped. It is an UPDATE over existing rows keyed on code_canonical, not a reload; the identity spine is good and must not be rebuilt.

VERIFY WHEN DONE (expect 14143 / 0)
  select count(display_name), count(*) - count(display_name) from catalog.designs;',
'todo', 2, 'agent', 'agent:install-troubleshooting-20260823'
WHERE NOT EXISTS (
  SELECT 1 FROM core.tasks
  WHERE title = 'Catalog naming layer never loaded: display_name NULL on all 14,143 designs'
    AND deleted_at IS NULL);

-- ---------------------------------------------------------------------
-- 2. The breed audit is stranded in a table named "retired".
-- ---------------------------------------------------------------------
INSERT INTO core.tasks (title, details, status, priority, source, written_by)
SELECT
'Carry the 270-row dog-breed audit into catalog.designs before it is lost',
'FOUND 2026-08-23. core.designs_retired_20260821 holds 270 rows and is NOT dead scaffold, despite the name it was given during the 2026-08-22 disk emergency. It is the LED-nightlight dog-breed registry: 198 breeds across art styles, audited by Carol, reviewed by Daren over five approval rounds (b0875bd4, 284ba738, 21e0f203, 2966d546, b64a607e) and carrying 65 recorded human decisions. Every one of the 270 rows has a real breed name and a name_confidence of confirmed / high / low.

catalog.designs has breed NULL on all 5,088 dog-family rows. The audit has not been carried across. It exists in exactly one place, in a table whose name invites deletion.

THE MAPPING, proposed not applied. In the registry, design_number is the BREED SLOT and art_style 1-6 are render folders; dropbox_path confirms it, e.g. design 1 -> "Night Light Stock Images/1/1_StPatDog1.png", design 2 -> "2/2_bdaydog2.png". In catalog.designs the same art appears as prefix + number, e.g. stpatdog133, and catalog.designs.primary_path for stpatdog133 is "St Patricks Dogs/StPatDog133.jpg". So:

  breed(N) from core.designs_retired_20260821 applies to <family>dog<N> in
  catalog.designs, for family in stpatdog, bdaydog, easterdog, motherdog,
  thankyoudog, graduationdog, vdog.

CONFIRM BEFORE WRITING, because this is an inference from paths and it would touch about 5,088 rows:
  - the bare "dog" prefix runs to number 796 while the registry stops at 270. Decide whether it is the same numbering before including it. It is excluded from the mapping above on purpose.
  - spot-check ten numbers by opening the file at catalog.designs.primary_path against the registry name.

RESOLVE FIRST: the registry has six breed-name spelling collisions, the same breed under two spellings. Loading them as-is fragments a breed into two, which is the exact failure gate 12ab7060 exists to prevent:
  "Cavalier King Charle Spaniel"  (212)  vs "Cavalier King Charles Spaniel"  (14)
  "Belgian Malinoi"               (32, 230) vs Belgian Malinois
  "Siberian Huskie"               (219)  vs "Siberian Husky"                 (21)
  "Great Pyrenee"                 (267)  vs "Great Pyrenees"                 (69, 189)
  "American Hairles Terrier"      (119)  vs American Hairless Terrier
  "Lowchen"                       (165)  vs "Lowchen" with an umlaut         (164)
Carol already flagged the Cavalier one on 2026-08-20 as a typo in the closed 198-name list itself, not a misidentification. The list is the thing to fix.',
'todo', 2, 'agent', 'agent:install-troubleshooting-20260823'
WHERE NOT EXISTS (
  SELECT 1 FROM core.tasks
  WHERE title = 'Carry the 270-row dog-breed audit into catalog.designs before it is lost'
    AND deleted_at IS NULL);

-- ---------------------------------------------------------------------
-- 3. Two approved renames that were never executed.
-- ---------------------------------------------------------------------
INSERT INTO core.tasks (title, details, status, priority, source, written_by)
SELECT
'Apply the two approved design renames that never executed (133, 185)',
'FOUND 2026-08-23 while reconciling the 54 backfilled approval_items executions. 52 of 54 landed. Two did not, and they are one event rather than two.

  design 133  approved "Cavalier King Charles Spaniel", registry still "English Toy Spaniel"
  design 185  approved "Havanese",                      registry still "Dandie Dinmont Terrier"

Both came from approval b64a607e, the pair Daren rejected in 2966d546 and that Carol re-staged with real images. core.activity_log shows review_restaged at 2026-08-20 17:27:23 and review_page_decisions (32 approved, 2 rejected) at 17:28:11, and Leo sent the Telegram confirmation. There is no decisions_applied entry after 15:45 that day. The decision was recorded and acknowledged; the executor never ran for it.

executed_at has been cleared on both rows and execution_ref now says so, so the data no longer asserts an execution that did not happen.

THE FIX IS A DECISION, NOT A RE-RUN. The registry these point at is core.designs_retired_20260821, which no executor is wired to any more. Either apply the two names there by hand, or fold them into the naming-layer work so they land directly in catalog.designs. Do not clear the approval; it is valid and Daren already decided it.

Worth noting for the agent design: an approval can be decided, acknowledged over Telegram and never executed, and until this pass nothing anywhere would have shown that. There is no reconciliation between a decided approval_item and the write it authorises.',
'todo', 3, 'agent', 'agent:install-troubleshooting-20260823'
WHERE NOT EXISTS (
  SELECT 1 FROM core.tasks
  WHERE title = 'Apply the two approved design renames that never executed (133, 185)'
    AND deleted_at IS NULL);

-- ---------------------------------------------------------------------
-- 4. last_run_at has the same defect last_result had.
-- ---------------------------------------------------------------------
INSERT INTO core.tasks (title, details, status, priority, source, written_by)
SELECT
'core.agents.last_run_at advances without an invocation - same bug as last_result',
'FOUND 2026-08-23 with direct evidence, two reads thirteen minutes apart:

  23:31:20  kate.last_run_at
  23:44:49  kate.last_run_at   (advanced)
  18:03:45  kate''s last actual agent_invocation in core.activity_log (unchanged)

No activity_log row exists for any run between 18:03 and 23:44. last_run_at is being written on the dispatcher''s standing-job check, roughly every 60 seconds, not when an agent is actually invoked. Kate is the only agent with a live schedule, so she is the only one where it shows.

This is the fourth instance of the same family. Wednesday it was insert_note failing silently. Then last_result reading process exit rather than work. Then a schedule firing into a standing job that did not exist. Now the timestamp itself. last_result was fixed on 2026-08-22 to read "ok, N writes", which is right, but it goes stale between real runs while last_run_at keeps moving, so the row still reads as a healthy recent run when nothing has happened.

FIX (Studio, ~/leo/dispatcher): write last_run_at only when an agent is actually invoked. If a heartbeat timestamp is wanted, give it its own column, e.g. last_checked_at, so the two cannot be confused.

UNTIL THEN, the honest query for "did this agent do anything" is:
  select max(created_at) from core.activity_log
  where actor = ''agent:kate'' and action = ''agent_invocation'';
This has been added to meta.brain_map so a new session does not trust the agents row.',
'todo', 2, 'agent', 'agent:install-troubleshooting-20260823'
WHERE NOT EXISTS (
  SELECT 1 FROM core.tasks
  WHERE title = 'core.agents.last_run_at advances without an invocation - same bug as last_result'
    AND deleted_at IS NULL);

-- ---------------------------------------------------------------------
-- 5. Leo's usage override expires today, by design.
-- ---------------------------------------------------------------------
INSERT INTO core.tasks (title, details, status, priority, source, written_by)
SELECT
'Leo usage ceiling: the 0.68 override expired 2026-08-23, back to 0.30 Monday',
'core.agents.leo.config carries usage_override_until = 2026-08-23 and usage_ceiling_fraction = 0.68, with Daren''s reasoning recorded in usage_override_reason: all-models quota was at 77%, willing to spend to about 90% through Sunday, keeping the rest for Monday daytime. It EXPIRES SUNDAY ON PURPOSE, and the note says explicitly "Do not extend without him."

Today is that Sunday. From Monday the ceiling drops back to 0.30 while the rolling weekly usage is still above it, so the fleet will halt itself before Daren''s Monday daytime use. That is the designed behaviour, not a fault, and it is written down here only so that when agents stop on Monday nobody spends the morning debugging Leo. They did exactly that on 2026-08-22, for 34 hours, before finding a frozen weekly_tokens counter of 109,187,153 in core.activity_log.

Two things to check rather than assume when it bites:
  - the halt is visible as action = ''usage_ceiling_hit'' in core.activity_log, with a FROZEN weekly_tokens value. A frozen counter plus a live heartbeat means work is being declined, not that there is no work.
  - 109M tokens in a week is either a real cost to approve or a runaway loop to find. Do not just raise the ceiling to make the red light stop.',
'todo', 3, 'agent', 'agent:install-troubleshooting-20260823'
WHERE NOT EXISTS (
  SELECT 1 FROM core.tasks
  WHERE title = 'Leo usage ceiling: the 0.68 override expired 2026-08-23, back to 0.30 Monday'
    AND deleted_at IS NULL);

-- ---------------------------------------------------------------------
-- Appends to existing tasks. Guarded so re-running does not duplicate text.
-- ---------------------------------------------------------------------

-- Gate 12ab7060: canonical art identity
UPDATE core.tasks
SET details = details || E'\n\n=== RECHECKED 2026-08-23, STILL NOT CLEARED, AND FOR A BIGGER REASON ===\n'
 || E'The 2026-08-22 check found 209 of 14,143 designs with no primary_sha256 and left the gate shut on that. Correct, but it understates the gap.\n\n'
 || E'catalog.designs.display_name is NULL on ALL 14,143 rows. So are descriptor, breed, name_source and name_confidence. design_family is set on 313. The identity spine loaded; the naming layer never ran.\n\n'
 || E'The clearing condition is canonical art identity that Carol can rank on and a human can read. code_canonical satisfies the first half and nothing satisfies the second. The gate stays shut until the naming layer runs, not merely until the 209 shas land. Tracked separately as "Catalog naming layer never loaded".\n\n'
 || E'Also unchanged: task b0869ff8 is still status=waiting, so the structure Daren was asked to approve before the load still has not been approved after it.'
WHERE gated_on_key = 'canonical-art-identity'
  AND deleted_at IS NULL
  AND details NOT LIKE '%RECHECKED 2026-08-23%';

-- af2f36f2: repoint Carol
UPDATE core.tasks
SET details = details || E'\n\n=== 2026-08-23: REPOINTING IS NECESSARY BUT NOT SUFFICIENT ===\n'
 || E'Carol is still correctly held; her schedule is still null and the original 0 2 * * * is still preserved in config.schedule_held.\n\n'
 || E'The three code changes listed above are still the right changes. But repointing her prompt, carol_jobs.py and the apply_output whitelist at catalog.* will NOT give her a working reconciliation, because catalog.designs has no names: display_name, descriptor, breed, name_source and name_confidence are NULL on all 14,143 rows, and catalog.sales_lifetime holds walmart only. Her two headline jobs, design-level sales ranking and catalog reconciliation, both need those.\n\n'
 || E'Correct order: run the catalog naming layer, then load the non-Walmart sales, then repoint Carol, then un-hold. Un-holding earlier just moves the failure from "table does not exist" to "every name is null", which is harder to notice because it does not raise.'
WHERE id::text LIKE 'af2f36f2%'
  AND deleted_at IS NULL
  AND details NOT LIKE '%REPOINTING IS NECESSARY BUT NOT SUFFICIENT%';

-- cdd4ee70: rerun catalog sales load
UPDATE core.tasks
SET details = COALESCE(details, '') || E'\n\n=== CONFIRMED STILL OPEN 2026-08-23 ===\n'
 || E'select distinct channel from catalog.sales_lifetime  ->  walmart, and nothing else.\n'
 || E'catalog.sales_lifetime 3,380 rows / sales_monthly 82,675 rows, all Walmart. catalog.channel_listings meanwhile covers amazon, ebay, etsy, shopify and walmart and has grown to 572,212 rows since the 2026-08-22 count of 402,357. So listings loaded for five channels and sales loaded for one. Any revenue or demand ranking taken off this schema today is Walmart-only and will read as though the other four channels sold nothing.'
WHERE id::text LIKE 'cdd4ee70%'
  AND deleted_at IS NULL
  AND COALESCE(details,'') NOT LIKE '%CONFIRMED STILL OPEN 2026-08-23%';

COMMIT;
