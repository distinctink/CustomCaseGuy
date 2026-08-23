-- =====================================================================
-- Reconcile the 54 backfilled approval_items executions
-- Project: ai-brain (gmzfqxxgarwtlwxltlzc)
-- Authored 2026-08-23. NOT YET APPLIED.
-- =====================================================================
--
-- BACKGROUND. On 2026-08-22 the brain-audit session backfilled
-- core.approval_items from the five decisions arrays in core.approvals.detail
-- and set executed_at = decided_at on the 54 approved rows, stamping
--   execution_ref = 'backfill-20260822: execution assumed from decided_at,
--                    NOT independently verified'
-- It set the value rather than leaving NULL because NULL means "approved and
-- cleared to run", and 8 three-day-old renames sitting claimable was a live
-- re-execution risk. Both sessions flagged that 54 rows now asserted an
-- execution nobody had checked, and left the reconciliation for whoever could
-- do it once the designs rebuild landed.
--
-- THE RECONCILIATION, done 2026-08-23. Each of the 54 approved items was
-- resolved back to the name it was approved to carry, from three shapes in
-- core.approvals.detail:
--   2966d546   review_items[].subtitle  "Proposed: X / high confidence"
--   b64a607e   review_items[].subtitle  "... -- propose X"
--   284ba738   review_items[].subtitle  "Propose rename to X."
--   21e0f203   review_items[].subtitle  "Propose rename to X as a one-time ..."
--   b0875bd4   high_confidence_renames[] / low_confidence_renames[] .new_name
-- and compared against core.designs_retired_20260821.name, which is the same
-- registry table the renames were applied to, renamed during the 2026-08-22
-- disk emergency. 54 of 54 resolved, no unparsed rows.
--
-- RESULT
--   52  LANDED       registry name matches the approved target exactly
--    2  NOT APPLIED  design 133 and design 185, both from approval b64a607e
--
-- The two failures are one event, not two. b64a607e was the pair re-staged
-- with real images after Daren rejected them in 2966d546 (activity_log
-- "review_restaged" 2026-08-20 17:27:23, "review_page_decisions" 32 approved
-- / 2 rejected at 17:28:11). He approved both at 17:28:11. There is no
-- "decisions_applied" entry in core.activity_log after 15:45 that day, so the
-- executor never ran for that approval. Approved, acknowledged over Telegram,
-- never written.
--     design 133  approved "Cavalier King Charles Spaniel", still "English Toy Spaniel"
--     design 185  approved "Havanese",                      still "Dandie Dinmont Terrier"
--
-- Per the handoff's own instruction, the fix for a rename that did not land is
-- to CLEAR executed_at, not to re-run a claim. Clearing is safe here: the
-- registry is core.designs_retired_20260821, which no executor is wired to,
-- and Carol is held. Nothing re-fires on its own.
--
-- This statement is data-driven rather than hand-typed, so it re-derives the
-- verdicts at run time. It is scoped to rows still carrying the backfill ref,
-- so re-running it is a no-op.
-- =====================================================================

BEGIN;

WITH ri AS (
  SELECT a.id AS aid, r->>'key' AS k, r->>'subtitle' AS sub
  FROM core.approvals a,
       LATERAL jsonb_array_elements(COALESCE(a.detail->'review_items','[]'::jsonb)) r
),
from_review AS (
  SELECT aid, k, trim(COALESCE(
    substring(sub FROM 'Propose rename to ([A-Za-z][A-Za-z '' .-]*?)(?: as | --|\.|,|$)'),
    substring(sub FROM '-- propose ([A-Za-z][A-Za-z '' .-]*?)(?:,|$)'),
    substring(sub FROM 'Proposed: ([^/]+?)\s*/')
  )) AS proposed
  FROM ri
),
from_arrays AS (
  SELECT a.id AS aid, e->>'design_number' AS dn, e->>'new_name' AS proposed
  FROM core.approvals a,
       LATERAL jsonb_array_elements(
         COALESCE(a.detail->'high_confidence_renames','[]'::jsonb)
         || COALESCE(a.detail->'low_confidence_renames','[]'::jsonb)) e
),
resolved AS (
  SELECT ai.id,
         COALESCE(fr.proposed, fa.proposed) AS target,
         d.name AS current_name
  FROM core.approval_items ai
  LEFT JOIN from_review fr ON fr.aid = ai.approval_id AND fr.k  = ai.source_key
  LEFT JOIN from_arrays fa ON fa.aid = ai.approval_id AND fa.dn = ai.id_value
  LEFT JOIN core.designs_retired_20260821 d ON d.design_number = ai.id_value
  WHERE ai.decision = 'approved'
    AND ai.execution_ref LIKE 'backfill-20260822%'
)
UPDATE core.approval_items ai
SET executed_at = CASE WHEN r.target = r.current_name THEN ai.executed_at ELSE NULL END,
    executed_by = CASE WHEN r.target = r.current_name THEN ai.executed_by ELSE NULL END,
    execution_ref = CASE WHEN r.target = r.current_name
      THEN 'verified-20260823: rename landed. core.designs_retired_20260821.name = "'
           || r.target || '", matches the approved target. Replaces the '
           || 'backfill-20260822 placeholder.'
      ELSE 'NOT APPLIED - verified-20260823: approval target was "' || r.target
           || '" but the registry still holds "' || r.current_name
           || '". Approval b64a607e was decided 2026-08-20 17:28:11 UTC and the '
           || 'executor never ran for it. executed_at cleared. The registry is '
           || 'core.designs_retired_20260821, which no executor is wired to, so '
           || 'nothing re-fires on its own.'
    END
FROM resolved r
WHERE r.id = ai.id
  AND r.target IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-check. Expect 52 / 2 / 0.
-- ---------------------------------------------------------------------
-- select
--   count(*) filter (where execution_ref like 'verified-20260823%')   as landed,
--   count(*) filter (where execution_ref like 'NOT APPLIED%')         as not_applied,
--   count(*) filter (where execution_ref like 'backfill-20260822%')   as still_unverified
-- from core.approval_items where decision='approved';
