# The brain: install and troubleshooting, closed out

**2026-08-23.** Aggregates the brain-audit session, the catalog-build session and the Leo/agent sessions into one record. Everything below was verified against the live database (`ai-brain`, ref `gmzfqxxgarwtlwxltlzc`) on 2026-08-23, not carried forward from the session notes.

The short version: **the schema install is done and holds. Two column drops are left. The catalog load is half-finished in a way nobody had noticed, and one class of agent-health bug is still live.**

---

## 1. What is installed and verified

Batch 2 of the schema revision was applied on 2026-08-21/22 as raw DDL, outside `supabase_migrations`, which is why it does not appear in the migration list. It is nonetheless in place. Every verification query the plan specified returns clean:

| Check | Result |
|---|---|
| Duplicate live document URIs | **0** (the Blower-Door-Test-Form pair was resolved; 86 documents soft-deleted, 510 live) |
| Live notes without a slug | **0** |
| Notes without a class | **0** |
| Superseded notes with no target | **0** |
| Billing rows off-matter | **0** — `matter_id` is `NOT NULL` with a real FK, the `matter` text column is gone |
| Gated tasks carrying a due date | **0** |
| Distinct gate keys | **8** (plan predicted 7; one more gate has since been raised) |

Also confirmed in place: `notes.slug` / `note_class` / `lifecycle` / `superseded_by` / `written_by` with all four CHECK constraints; the `UNIQUE(slug) WHERE lifecycle='live'` index; `tasks.gated_on_key` / `gated_on` / `no_date_reason` / `written_by` with both gate CHECKs and the partial index; `tasks.due_at` dropped; `entity_type`/`entity_id` dropped from `documents`, `tasks` and `events`; `billing.deleted_at`, its missing `updated_at` trigger, and `billing.amount` rebuilt as `GENERATED ALWAYS AS (round(hours*rate,2)) STORED`; `contacts.title`; `documents.written_by`; the priority-scale COMMENT with account survival folded into priority 1.

The three Phase C locks — the ones that could not be created until the data was clean — are all built.

**The audit's own numbers, for the record.** 760 rows ruled across 9 tables: 383 UPDATE, 219 DONE, 129 KILL, 17 GATED, 12 KEEP. Heaviest tables `core.tasks` (293), `core.notes` (250), `core.documents` (141). Today the brain holds 105 live notes, 121 logs, 26 superseded, 108 open tasks, 510 live documents.

---

## 2. What is left on the schema — two column drops

`core.notes.entity_type` and `core.notes.expires_at` are the only parts of the approved plan never run. Migration `brain/migrations/20260823_01_finish_notes_columns.sql` does it.

Both are safe, and the caller list was checked first — the step that was skipped three times in three days and broke a consumer each time:

- **No view** reads either column. `v_stale_notes`, which existed only to surface `expires_at`, is already gone.
- **No function** reads them except the shim. The `expires_at` matches in `approval_items_bi`, `claim_item` and `expire_approval_items` are a different column on a different table.
- `expires_at` has **0 rows populated**. `entity_type` has **1**: the `ebay-personalization-split-spec` note, value `'project'` — and that note already carries `project_id → ebay-personalization-split`, so the value is exactly the redundancy the audit predicted. Nothing is lost.

**On the shim, which the two overnight sessions could not settle.** They were arguing about whether to drop `trg_notes_compat_shim`, gated on Carol and Kate each landing a clean note. That condition became unsatisfiable when Carol was held indefinitely. The argument was also aimed at the wrong object: the shim does four jobs, and only two are legacy.

| Job | Verdict |
|---|---|
| `entity_type` → `note_class` vocabulary mapping | dies with the column |
| `NEW.expires_at := NULL` | dies with the column |
| Default `note_class`, or `notes_class_req_ck` rejects the insert | **load-bearing, keep** |
| Demote an unslugged live note to `log`, or `notes_live_slug_ck` rejects the insert | **load-bearing, keep** |

Dropping the trigger outright would have started rejecting every insert that omits `note_class` or `slug`. The migration renames it to `core.notes_write_defaults()` and keeps the half that is real write discipline. That resolves the deadlock without waiting on an agent that cannot run.

One consequence, stated plainly: after this runs, a session that writes `entity_type` gets a hard error. An interactive chat session did exactly that on 2026-08-23. Failing loudly is the intent — a silent write into a dead column is what the audit existed to stop.

---

## 3. The 54 unverified executions: reconciled, and two of them were wrong

The 2026-08-22 backfill set `executed_at = decided_at` on 54 approved design renames and stamped them `backfill-20260822: execution assumed from decided_at, NOT independently verified`. Both sessions flagged that 54 rows now asserted an execution nobody had checked, and left it for whoever could reconcile once the designs rebuild landed.

Done. Each item was resolved back to the name it was approved to carry — from `review_items[].subtitle` prose in four different phrasings and from the `high_confidence_renames` / `low_confidence_renames` arrays in the fifth approval — and compared against `core.designs_retired_20260821.name`, the same registry the renames were applied to. **54 of 54 resolved, no unparsed rows.**

- **52 landed.** The backfill's assumption was right for these, and `execution_ref` can now say so instead of hedging.
- **2 did not.** Both from approval `b64a607e`:
  - design **133** — approved *Cavalier King Charles Spaniel*, registry still holds *English Toy Spaniel*
  - design **185** — approved *Havanese*, registry still holds *Dandie Dinmont Terrier*

They are one event, not two. `b64a607e` is the pair Daren rejected in `2966d546` and Carol re-staged with real images. `core.activity_log` has `review_restaged` at 17:27:23 and `review_page_decisions` (32 approved, 2 rejected) at 17:28:11 on 2026-08-20, and Leo sent the Telegram confirmation — but there is no `decisions_applied` entry after 15:45 that day. **The decision was recorded, acknowledged to Daren, and never executed.**

Migration `20260823_02` replaces the placeholder ref on the 52 and clears `executed_at` on the 2, which is the fix the handoff itself prescribed. Clearing is safe: the registry is `core.designs_retired_20260821`, which no executor is wired to, and Carol is held.

The design lesson is bigger than the two rows. **Nothing in the system reconciles a decided `approval_item` against the write it authorises.** An approval can be approved, acknowledged and silently unexecuted, and until this pass nothing anywhere would have surfaced it.

---

## 4. The largest finding: the catalog naming layer never ran

Not recorded anywhere upstream. Verified directly:

```
select count(*), count(display_name), count(descriptor), count(breed),
       count(name_source), count(primary_sha256), count(design_family)
from catalog.designs;
-->    14143,  0,  0,  0,  0,  13934,  313
```

The identity spine of the catalog load succeeded — `code_canonical` on all 14,143 rows, 14,143 distinct, clean 1:1. **The human-readable layer is empty on every single row.**

This reframes three open items:

- **Gate `12ab7060` (canonical-art-identity)** was checked on 2026-08-22 and correctly left shut on the 209 designs missing a `primary_sha256`. The real reason is larger: there are no names at all. Carol's design-level sales ranking needs an identity a human can read in a brief; `code_canonical` is not that.
- **Task `b0869ff8`** asks Daren to approve, among other things, "the naming rule display_name = file stem + descriptor with padding preserved". That rule has not been executed on one row. Approving the structure does not by itself produce named designs.
- **Task `af2f36f2` (repoint Carol)** is necessary but not sufficient. Repointing her at `catalog.*` moves her failure from *table does not exist* to *every name is null*, which is harder to notice because it does not raise.

The fix is an UPDATE over existing rows keyed on `code_canonical`, not a reload. The spine is good and must not be rebuilt.

**Related, and time-sensitive.** `core.designs_retired_20260821` holds 270 rows and is **not** dead scaffold, despite the name it was given during the disk emergency. It is the LED-nightlight dog-breed registry — 198 breeds, audited by Carol, reviewed by Daren across five approval rounds, carrying 65 recorded human decisions. `catalog.designs.breed` is NULL on all 5,088 dog-family rows. That work exists in exactly one place, in a table whose name invites deletion.

The mapping is inferable (`breed(N)` from the registry applies to `<family>dog<N>` in the catalog; the `primary_path` values confirm it), and it is written up with its caveats in the task — but it would touch ~5,088 rows on an inference, so it is proposed, not applied. Six breed-name spelling collisions in the registry need resolving first (`Cavalier King Charle Spaniel` vs `…Charles…`, `Belgian Malinoi`, `Siberian Huskie`, `Great Pyrenee`, `American Hairles Terrier`, `Lowchen`/`Löwchen`) or they fragment a breed in two — the exact failure the gate exists to prevent. Carol already identified the Cavalier one as a typo in the closed 198-name list itself.

**Sales are Walmart-only.** `catalog.sales_lifetime` and `sales_monthly` carry `walmart` and nothing else, while `channel_listings` covers all five channels and has grown to 572,212 rows. Any revenue or demand ranking taken off this schema today reads as though four channels sold nothing. Task `cdd4ee70` was already open for this and is confirmed still open.

---

## 5. Troubleshooting: what is fixed, and what is still broken

### Resolved and verified healthy

| | |
|---|---|
| **Dispatcher** | Up. Hourly heartbeat, last 23:06 UTC. The 4h43m outage of 2026-08-21 is closed. |
| **Cause of that outage** | The `leo_sql` revoke from `anon`, not the prompt patch. The dispatcher authenticates with the publishable key, which *is* the anon role. 268 identical `permission denied for function leo_sql` lines. |
| **Disk** | Resolved. Pro plan, 887 MB of 8 GB. The Free-tier read-only incident and the "keep writes small" constraint are both closed. |
| **Kate** | Working end to end. Wrote `tech-watch-2026-08-23` at 18:03 UTC and queued Leo a follow-up task. Her missing standing job was fixed on 2026-08-22. |
| **Leo** | Working. Prompt patched with a read manifest and a rule that missing collectors get named out loud. |
| **`last_result`** | Fixed to report writes (`ok, 3 writes`) rather than process exit. |
| **Security scope** | Correctly narrowed. Revoke `leo_sql` **only**; the other six SECURITY DEFINER functions take no caller-supplied SQL and five are what the IP-compliance sweeps call on the pg_cron schedule. Revoking them stops the sweeps silently, which is an account-health risk. |

### Still broken

**`core.agents.last_run_at` advances without an invocation.** Two reads thirteen minutes apart:

```
23:31:20   kate.last_run_at
23:44:49   kate.last_run_at          <- advanced
18:03:45   kate's last agent_invocation in core.activity_log   <- unchanged
```

No `activity_log` row exists for any run between. `last_run_at` is written on the dispatcher's standing-job check, roughly every 60 seconds, not on an actual invocation. Kate is the only agent with a live schedule, so she is the only one where it shows.

This is the **fourth** instance of the same family, and the one nobody had isolated: Wednesday it was `insert_note` failing silently; then `last_result` reading process exit; then a schedule firing into a standing job that did not exist; now the timestamp itself. `last_result` was fixed, correctly — but it goes stale between real runs while `last_run_at` keeps moving, so the row still reads as a healthy recent run when nothing has happened.

Until it is fixed on the Studio, the honest query is:

```sql
select max(created_at) from core.activity_log
where actor = 'agent:kate' and action = 'agent_invocation';
```

That warning is now written into `meta.brain_map` so a new session does not trust the agents row.

**`meta.brain_map` is wrong in both directions.** It is the first thing every session reads, and it currently opens with a stale-warning header instead of correct content. It describes four dropped `core.*` tables as live, omits the `catalog` schema entirely, states that `notes.entity_type` and `expires_at` were dropped when they were not, asserts a Free-tier disk emergency that is resolved, and reports 12 agents with only Leo and Carol active when it is 14 with five active. Migration `20260823_03` rewrites it.

### Standing, by design — not a fault

Leo's `usage_override_until` is **2026-08-23**, today. From Monday the ceiling drops back to 0.30 while rolling weekly usage is still above it, so the fleet halts itself before Daren's Monday daytime use. Daren's own note says "Do not extend without him."

This is recorded only so that when agents stop on Monday, nobody spends the morning debugging Leo — which is exactly what happened on 2026-08-22, for 34 hours, before someone found a frozen `weekly_tokens` counter of 109,187,153. **A frozen counter plus a live heartbeat means work is being declined, not that there is no work.** And 109M tokens in a week is either a real cost to approve or a runaway loop to find; do not just raise the ceiling to make the red light stop.

---

## 6. The four things that actually gate progress

Unchanged in shape from the overnight close-out, but two of them are further from done than recorded:

1. **Daren approves the catalog structure** (`b0869ff8`, still `waiting`) — and note that the load already ran without it.
2. **The catalog naming layer runs** — new, and it now sits ahead of Carol rather than behind her.
3. **Carol is repointed at `catalog.*`, then un-held** (`af2f36f2`) — after 2, not before.
4. **The service key goes in so `leo_sql` can close** (`bf3efd3b`) — Studio-side; `config.py` is already staged to prefer it.

Correct order for 2–3: run the naming layer, load the non-Walmart sales, repoint Carol, then un-hold.

---

## 7. What is in this directory

| File | Status |
|---|---|
| `migrations/20260823_01_finish_notes_columns.sql` | Written, verified safe, **not applied** |
| `migrations/20260823_02_reconcile_approval_item_executions.sql` | Written, re-derives its verdicts at run time, **not applied** |
| `migrations/20260823_03_brain_map_rewrite.sql` | Written, merges only changed keys, **not applied** |
| `migrations/20260823_04_findings_tasks.sql` | Written, every insert guarded on title, **not applied** |
| `verify.sql` | Reads only, safe any time |

Nothing in this pass was written to the live database. Writes were blocked by the session's permission mode, so the change set is committed here for review and one-command application instead. Apply in numeric order; each file is idempotent and carries its own post-check.
