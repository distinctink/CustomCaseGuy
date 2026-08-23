-- =====================================================================
-- Batch 2, Phase A remnants: A.3 and A.4
-- Project: ai-brain (gmzfqxxgarwtlwxltlzc)
-- Authored 2026-08-23. NOT YET APPLIED.
-- Apply with: supabase apply_migration
--   name: batch2_finish_notes_drop_entity_type_and_expires_at
-- =====================================================================
--
-- Everything else in batch 2 was applied 2026-08-21/22 as raw DDL and was
-- never recorded in supabase_migrations. These two column drops were the
-- only parts of the approved plan that were never run at all.
--
-- A.3  core.notes.expires_at   auto-expiry. 0 rows populated.
--      Contradicts the standing rule that nothing is deleted because a date
--      passed. core.v_stale_notes, the view that surfaced it, is already gone.
--
-- A.4  core.notes.entity_type  the polymorphic class column. 1 row populated:
--      note "ebay-personalization-split-spec", value 'project'. That note
--      already carries project_id -> core.projects(ebay-personalization-split),
--      so the value is fully redundant and nothing is lost by dropping it.
--      core.notes.entity_id was dropped in the original batch-2 pass.
--
-- CALLER LIST, checked before writing this (the step that was skipped three
-- times in three days and broke a consumer each time):
--   views     : none. v_live_notes, v_unreviewed_notes, v_today, v_gated,
--               v_daily_briefing and v_shopping reference neither column.
--   functions : core.notes_compat_shim only. core.approval_items_bi,
--               core.claim_item and core.expire_approval_items match on
--               "expires_at" but that is core.approval_items.expires_at, a
--               different column on a different table. Untouched.
--   writers   : the dispatcher's insert_note path has written 0 rows carrying
--               either column since the 2026-08-21 prompt patch. The single
--               entity_type value came from an interactive chat session on
--               2026-08-23. After this migration such a write fails loudly at
--               parse time rather than silently landing in a dead column,
--               which is the intent.
--
-- THE SHIM IS NOT SIMPLY DROPPED. It was doing four jobs. Two die with the
-- columns; two are load-bearing write discipline that must outlive them:
--   dies  : entity_type -> note_class vocabulary mapping
--   dies  : NEW.expires_at := NULL
--   stays : default note_class, or notes_class_req_ck rejects the insert
--   stays : demote an unslugged live note to log, or notes_live_slug_ck
--           rejects the insert
-- Dropping the trigger outright, as the overnight sessions kept debating,
-- would have started rejecting every insert that omits note_class or slug.
-- It is renamed instead, to say what it actually is now.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION core.notes_write_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'core', 'pg_temp'
AS $function$
BEGIN
  -- notes_class_req_ck requires a class on every undeleted row. Default it
  -- rather than reject, so a caller that forgets still lands the content.
  IF NEW.note_class IS NULL THEN
    NEW.note_class := 'session_log';
  END IF;

  -- An unslugged note cannot be live. That is the write discipline, applied
  -- rather than rejected: the content lands, it just lands as a log.
  IF NEW.lifecycle = 'live' AND NEW.slug IS NULL THEN
    NEW.lifecycle := 'log';
  END IF;

  IF NEW.written_by IS NULL THEN
    NEW.written_by := COALESCE(NEW.source, 'unknown');
  END IF;

  RETURN NEW;
END $function$;

COMMENT ON FUNCTION core.notes_write_defaults() IS
  'Write defaults for core.notes: note_class, live-requires-slug, written_by. '
  'Successor to notes_compat_shim; the legacy entity_type/expires_at handling '
  'was dropped with those columns on 2026-08-23.';

DROP TRIGGER IF EXISTS trg_notes_compat_shim ON core.notes;

CREATE TRIGGER trg_notes_write_defaults
  BEFORE INSERT ON core.notes
  FOR EACH ROW EXECUTE FUNCTION core.notes_write_defaults();

DROP FUNCTION IF EXISTS core.notes_compat_shim();

ALTER TABLE core.notes
  DROP COLUMN entity_type,
  DROP COLUMN expires_at;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-check. Both must return 0 rows.
-- ---------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema='core' and table_name='notes'
--    and column_name in ('entity_type','entity_id','expires_at');
--
-- select tgname from pg_trigger
--  where tgrelid='core.notes'::regclass and tgname='trg_notes_compat_shim';
