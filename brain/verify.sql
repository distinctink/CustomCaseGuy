-- =====================================================================
-- Brain install verification suite
-- Project: ai-brain (gmzfqxxgarwtlwxltlzc)
-- Last run 2026-08-23. Safe to run any time; reads only.
--
-- Section A is the batch-2 schema contract. Every row must come back 0 except
-- where noted, and every one of these did on 2026-08-23.
-- Section B is the install state: things that are true today and should be
-- rechecked rather than assumed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. BATCH 2 SCHEMA CONTRACT
-- ---------------------------------------------------------------------
select 'A1  duplicate live document uri'      as check, count(*)::text as actual, '0' as expect
  from (select uri from core.documents where deleted_at is null
        group by uri having count(*) > 1) z
union all
select 'A2  live note without a slug', count(*)::text, '0'
  from core.notes where lifecycle='live' and deleted_at is null and slug is null
union all
select 'A3  note without a class', count(*)::text, '0'
  from core.notes where deleted_at is null and note_class is null
union all
select 'A4  superseded note with no target', count(*)::text, '0'
  from core.notes where lifecycle='superseded' and superseded_by is null
union all
select 'A5  billing row off-matter', count(*)::text, '0'
  from core.billing where matter_id is null
union all
select 'A6  gated task carrying a due date', count(*)::text, '0'
  from core.tasks where gated_on_key is not null and due_date is not null
union all
select 'A7  gate keys are shared not per-row', count(distinct gated_on_key)::text, '~7-8'
  from core.tasks where gated_on_key is not null and deleted_at is null
union all
-- These two go to 0 only after migration 20260823_01 is applied.
select 'A8  notes.entity_type still exists', count(*)::text, '0 after 20260823_01'
  from information_schema.columns
 where table_schema='core' and table_name='notes' and column_name='entity_type'
union all
select 'A9  notes.expires_at still exists', count(*)::text, '0 after 20260823_01'
  from information_schema.columns
 where table_schema='core' and table_name='notes' and column_name='expires_at'
union all
select 'A10 billing.amount is generated', a.attgenerated::text, 's'
  from pg_attribute a
 where a.attrelid='core.billing'::regclass and a.attname='amount'
union all
select 'A11 approval_items still unverified', count(*)::text, '0 after 20260823_02'
  from core.approval_items where execution_ref like 'backfill-20260822%';

-- ---------------------------------------------------------------------
-- B. INSTALL STATE
-- ---------------------------------------------------------------------
select 'B1  catalog designs with a display_name' as check,
       count(display_name)::text || ' of ' || count(*)::text as actual,
       '14143 of 14143 when the naming layer has run' as expect
  from catalog.designs
union all
select 'B2  catalog designs with no sha256', count(*)::text, '0 when complete'
  from catalog.designs where primary_sha256 is null
union all
select 'B3  channels present in sales', string_agg(distinct channel, ', '), 'all five'
  from catalog.sales_lifetime
union all
select 'B4  channels present in listings', string_agg(distinct channel, ', '), 'all five'
  from catalog.channel_listings
union all
select 'B5  dispatcher last heartbeat', max(created_at)::text, 'within the hour'
  from core.activity_log where action='dispatcher_heartbeat'
union all
select 'B6  last real agent invocation', max(created_at)::text, 'recent if agents are running'
  from core.activity_log where action='agent_invocation'
union all
select 'B7  usage ceiling last hit', coalesce(max(created_at)::text,'(never)'), 'stale is good'
  from core.activity_log where action='usage_ceiling_hit'
union all
select 'B8  database size', round(pg_database_size(current_database())/1024.0/1024.0,1)::text || ' MB',
       'under 8192 MB on Pro'
union all
select 'B9  agents active / held', count(*) filter (where active)::text || ' active, '
       || count(*) filter (where config ? 'schedule_held')::text || ' held', '5 active, 1 held'
  from core.agents
union all
select 'B10 agent rows lying about last run',
       count(*)::text, '0 after the last_run_at fix'
  from core.agents a
 where a.active
   and a.last_run_at > coalesce((select max(created_at) from core.activity_log l
                                  where l.actor='agent:'||a.name
                                    and l.action='agent_invocation'), '-infinity')
                       + interval '10 minutes';
