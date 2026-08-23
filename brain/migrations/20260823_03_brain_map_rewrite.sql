-- =====================================================================
-- Rewrite meta.brain_map to match reality
-- Project: ai-brain (gmzfqxxgarwtlwxltlzc)
-- Authored 2026-08-23. NOT YET APPLIED.
-- =====================================================================
--
-- brain_map is the first thing every new session reads. It is currently wrong
-- in both directions and carries a stale-warning header instead of correct
-- content:
--
--   1. orientation opens with "*** STALE AS OF 2026-08-22 03:55 UTC ***" and
--      is used as a correction log rather than an orientation.
--   2. It states core.notes.entity_type and expires_at were DROPPED. They were
--      not; migration 20260823_01 is what actually drops them.
--   3. It states the database is at ~508 MB against a 500 MB Free-tier limit
--      and may go read-only. Resolved: Daren upgraded to Pro on 2026-08-22.
--      Now 887 MB of 8 GB.
--   4. schema_index.core describes core.designs and core.marketplace_listings
--      as the live registry. Both are dropped.
--   5. schema_index.commerce closes with "live registry is core.designs +
--      core.design_products + core.design_aliases + core.marketplace_listings".
--      All four are gone.
--   6. schema_index has no "catalog" key at all, which is where the entire
--      marketplace catalog now lives.
--   7. It says agents is "12 rows, only leo+carol active". It is 14 rows;
--      leo, kate, charlie and joey are active and carol is held.
--
-- The connections section is long, current and expensive to reproduce, so this
-- statement merges over only the keys that changed and leaves it untouched.
-- =====================================================================

BEGIN;

UPDATE meta.brain_map
SET updated_at = now(),

    orientation =
'This Supabase project (ref gmzfqxxgarwtlwxltlzc, name ai-brain) IS the brain. There is no separate iCloud database layer for structured data. Day-to-day tasks, listings, legal matters, real estate, the marketplace catalog and the Leo agent fleet all live in Postgres here, organized into schemas by domain. Do NOT assume data is absent by checking only the public schema; public holds almost nothing. Always consult this map first, then query the relevant schema. When adding new capabilities, create or reuse a domain schema rather than dumping tables in public.

MAINTENANCE RULE: whenever any surface adds, renames, moves or removes a schema or a meaningful table, it MUST update this brain_map record in the same operation, so the map never drifts from reality. Treat the map as part of the change, not an afterthought. A correction appended to the bottom is not a substitute for fixing the body: on 2026-08-22 this record carried a stale-warning header for a day while its schema_index still described four dropped tables as live.

WRITE DISCIPLINE ON core.notes, enforced by the database, not by convention:
  - Every note carries note_class (8 values) and lifecycle (live | log | superseded).
  - A LIVE note must have a slug, and slugs are UNIQUE among live notes. If a live note already holds the slug you resolved, the database refuses a second one and your only option is to EDIT the existing row. That is deliberate: it is what stops the same subject existing twice.
  - A briefing or any "what is true now" query must filter lifecycle = ''live''. Session narratives are lifecycle = ''log'' and are not rules.
  - Archive means SOFT delete. Done and Kill both set deleted_at; rows leave every view and stay fully recoverable. Nothing is hard-deleted, and nothing is ever swept because a date passed.
  - core.notes.entity_type, entity_id and expires_at are GONE (batch 2, finished 2026-08-23). If an insert fails naming one of them, the fix is to drop the column from your statement, not to re-add it. Class goes in note_class, the target of a supersession goes in superseded_by, filing goes in project_id.

GATES ON core.tasks: a task waiting on an external condition carries gated_on_key (the slug you match on, e.g. harvard-permit-BLD2026-14714) and gated_on (the prose you read), and MUST have no due_date. That is enforced. Clearing one gate releases every row sharing the key at once. Gated rows never age.

PRIORITY SCALE, anchored in a COMMENT on core.tasks.priority: 1 = legal or regulatory deadline, OR account survival threat (marketplace suspension/deactivation). 2 = external party waiting. 3 = money moving. 4 = no deadline. 5 = idea, NEVER ages, excluded from all staleness and triage.

STORAGE: Supabase Pro since 2026-08-22. 887 MB of 8 GB. The Free-tier read-only incident of 2026-08-22 is closed and the "keep writes small" constraint no longer applies.

AGENT ROWS ARE NOT EVIDENCE OF WORK. core.agents.last_run_at advances on the dispatcher''s standing-job check, not on an actual invocation: kate''s last_run_at moves every minute while her last real agent_invocation in core.activity_log is hours old. last_result was fixed on 2026-08-22 to report writes ("ok, 3 writes") rather than process exit, but it goes stale between real runs. To find out whether an agent actually did anything, query core.activity_log for action = ''agent_invocation'' and actor = ''agent:<name>''. Never trust the agents row alone.',

    schema_index = schema_index || jsonb_build_object(

      'core',
      'Daily life and hub. tasks, reminders, events, notes, contacts, projects, shopping_items, availability, documents, activity_log. Views: v_today and v_daily_briefing (what is on my plate), v_live_notes (lifecycle=live only, the ONLY correct source for current rules), v_gated (tasks waiting on a condition), v_unreviewed_notes, v_shopping. Daily task queries go here.

LEO AGENT SYSTEM (phase 1, 2026-08-19): agents (roster, 14 rows; active = leo, kate, charlie, joey; carol is active but HELD with her schedule cleared and preserved in config.schedule_held; the other 9 are planned and have never run), agent_tasks (work queue), approvals (the ONLY path to consequential actions; Telegram inline buttons or the leo-review web page decide), approval_items (one row per individually decidable item inside an approval), catalog_flags (compliance/mismatch findings, Leo triages). All service-role-only RLS. Dispatcher and prompts live in ~/leo on the Studio, NOT in this database. Agent audit trail is core.activity_log with actor = agent:<name>.

core.approval_items: item_key is a GENERATED column, domain:account:id_kind:id_value, identifying the thing the executing API call addresses. id_value is stored VERBATIM, never lowercased or padded, so it round-trips to the value the API needs. A UNIQUE partial index on item_key WHERE decision=approved AND executed_at IS NULL means only one approval can hold an item cleared-to-run at a time, which is what makes core.claim_item(approval_id, item_key, actor, ref) safe: it returns true exactly once, so a kill or rename cannot execute twice on the 60-second dispatcher cadence. core.expire_approval_items() is the mandatory other half; without it an undecided row holds its item_key forever. service_role only, NO DELETE GRANT: an approval_item is decided, never removed. TRAP: item_key is GENERATED, so NEW.item_key is NULL inside a BEFORE trigger; core.approval_items_bi() rebuilds the string locally and anything else hung off a before trigger on that table must do the same.

DROPPED 2026-08-21/22, do not look for them here: core.designs, core.marketplace_listings, core.design_products, core.design_aliases. They were replaced by the catalog schema (see the catalog key). One table survives the move and still matters: core.designs_retired_20260821, 270 rows, which is NOT dead scaffold. It is the LED-nightlight dog-breed registry that Leo, Carol and Daren audited over five approval rounds in August 2026, and it is the only place those 270 human-decided breed names exist. It has not been carried into catalog.designs. Do not drop it.',

      'catalog',
      'THE MARKETPLACE CATALOG, canonical since 2026-08-21/22 (project 48_catalog-build_2026-08-21). Replaces the four dropped core.* tables. Five layers:
  designs           14,143  one row per distinct piece of art. code_canonical (prefix + number, e.g. stpatdog133) is the identity spine, 14,143 distinct, clean 1:1, anchored on primary_sha256.
  design_aliases    15,758  maps the marketplace code namespaces onto code_canonical.
  design_products  235,329  which items a design is printed on.
  channel_listings 572,212  live listing snapshots, channels: amazon, ebay, etsy, shopify, walmart.
  design_files      69,648  hashed source files.
  sales_lifetime     3,380  and sales_monthly 82,675. WALMART ONLY so far; the other channels have not been loaded (core.tasks cdd4ee70).
  sources, reconciliation_log (8,574 rows), refresh_log.

TWO THINGS ARE NOT DONE, and anyone querying this schema should know before they trust it:
  1. THE NAMING LAYER NEVER RAN. display_name, descriptor, breed, name_source and name_confidence are NULL on all 14,143 rows, and design_family is set on only 313. The identity spine loaded; the human-readable layer did not. Anything that needs a design NAME cannot get it from this schema yet.
  2. 209 of 14,143 designs have no primary_sha256, so their code_canonical is anchored to nothing.
Because of (1) and (2), gate canonical-art-identity (core.tasks 12ab7060) does NOT clear, and Carol must not be un-held to rank designs by name. Approval of the structure itself is still open on core.tasks b0869ff8.',

      'commerce',
      'E-commerce policy and compliance. IP KILL SYSTEM (rebuilt 2026-08-10, single source of truth, do NOT hand-maintain copies): banned_skus = design codes permanently banned from ALL marketplaces, with family + exceptions columns; banned_themes = title/keyword regexes per IP family, confidence high (auto-kill) or review (flag only). DESIGN CODES ARE NOT AUTHORITATIVE on their own: the same artwork exists under multiple codes across product lines, so ALWAYS match title themes as well as codes (267 of 782 live Walmart violations were code-invisible). Channel exemptions live at FAMILY level (e.g. Doctor Who/Tardis stays live on Etsy customcaseguy only). Read both via public.get_ip_killlist(); new codes via public.get_new_banned_codes(). compliance_sweeps = audit trail of every automated sweep (edge function ip-compliance-sweep, pg_cron daily 09:07/09:22/09:37/09:52 UTC for walmart/ebay/etsy/amazon, mode=enforce); write via public.record_compliance_sweep(), which also opens or updates a core.tasks item. compliance_state = watermark. Trigger commerce.on_new_banned_code() opens a task whenever a code is added, because the Amazon and Walmart daily sweeps are DELTA-only (recent writes) while eBay and Etsy are full-catalog.

card_catalog_rollup + card_pricing (2026-08-10): the DistinctInk greeting-card catalog, 6,846 designs all approved. Rollup is occasion x family x life_stage x style; pricing is the settled per-channel pack ladder with contribution and margin. ROW-LEVEL detail is deliberately NOT in Postgres: fetch the public CSVs at https://distinctinkimages.s3.amazonaws.com/cards/data/ (catalog.csv, listing_copy.csv, channel_ladder.csv, drop_list.csv, art_index.tsv). Full reference note: core.notes slug for the card catalog.

RETIRED 2026-08-20 (approval 16389b2e): commerce.designs / products / listings renamed to *_retired_20260820, 0/0/0 rows confirmed, dead scaffold unrelated to the marketplace catalog. Do not repurpose. The live catalog is the catalog schema, NOT core.designs and NOT commerce.designs.',

      'public',
      'Nearly empty by design. demo_views (RLS off, low stakes) and transient items only. Do not store real data here. What DOES live here is the RPC surface: reader functions for connections.secrets (get_spapi_secrets, get_walmart_secrets, get_ebay_secrets, get_ebaytt_secrets, get_etsy_secrets, get_etsydi_secrets, get_shopify_secrets, get_gmail_secrets, get_shipstation_secrets, get_ads_secrets), the writers that persist rotated OAuth tokens, the IP-sweep functions (get_ip_killlist, get_new_banned_codes, get_sweep_cursor, set_sweep_cursor, record_compliance_sweep) and public.leo_sql.

SECURITY POSTURE, current: seven SECURITY DEFINER functions are reachable by the anon role. Only leo_sql is a real exposure, because it takes arbitrary SQL as a text parameter and runs it as the definer, which includes SELECT on connections.secrets. It is guarded: a non-service_role caller must present leo_dispatcher_key from connections.secrets or it raises unauthorized, and it fails closed when the secret row is missing. The remediation is core.tasks bf3efd3b: add the service key, repoint the dispatcher, then revoke leo_sql ONLY. DO NOT revoke the other six. They take no caller-supplied SQL, five of them are what the ip-compliance-sweep edge function calls on the pg_cron schedule, and revoking them stops the IP kill sweeps SILENTLY, which is an account-health risk. Revoking leo_sql from anon without repointing the dispatcher first is what caused the 4h43m outage on 2026-08-21.'
    )
WHERE id = 1;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-check.
-- ---------------------------------------------------------------------
-- select updated_at,
--        orientation like '%STALE AS OF%'            as still_stale_header,
--        schema_index ? 'catalog'                    as has_catalog_key,
--        schema_index->>'core' like '%DROPPED%'      as core_notes_the_drops
-- from meta.brain_map where id = 1;
