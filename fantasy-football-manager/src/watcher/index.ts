/**
 * The always-on watcher.
 *
 * Loop: poll ESPN -> find material events -> resolve who benefits -> rebuild
 * the Yahoo context -> plan -> execute. Trades are detected and escalated to
 * you; they are never executed here.
 *
 * Failure policy: a bad poll must never kill the process. Every iteration is
 * wrapped, errors back off, and the loop keeps running through an ESPN outage
 * or a Yahoo hiccup.
 */

import { getNews, getInjuries } from '../espn/api.js';
import { injuryEvents, newsEvents, beneficiaries, affectsMyRoster, type MaterialEvent } from './events.js';
import { notify } from './notify.js';
import { buildContext, invalidateContext, type DecisionContext } from '../engine/context.js';
import { planMoves, executePlan, type RoleSignal, type Plan } from '../engine/decide.js';
import { getPendingTrades } from '../yahoo/read.js';
import { requestApproval } from '../store/approvals.js';
import { loadState, saveState, markSeen, hasSeen } from '../store/state.js';
import { loadStrategy, env } from '../config.js';
import { logger } from '../util/log.js';

const log = logger('watcher');

export interface WatchOptions {
  leagueKey?: string;
  /** Run a single iteration and return, for cron-style scheduling or testing. */
  once?: boolean;
  /** Plan but never write, regardless of DRY_RUN. */
  planOnly?: boolean;
}

/** In-memory snapshot of the injury table between iterations. */
let injurySnapshot = new Map<string, string>();

let stopping = false;

export function requestStop(): void {
  stopping = true;
}

export async function watch(opts: WatchOptions = {}): Promise<void> {
  const strategy = loadStrategy();
  const intervalMs = Math.max(30, strategy.execution.pollIntervalSeconds) * 1000;

  log.info(
    `watcher starting: poll every ${strategy.execution.pollIntervalSeconds}s, ` +
      `max ${strategy.execution.maxTransactionsPerDay} moves/day, ` +
      `dryRun=${env.dryRun || !!opts.planOnly}`,
  );

  // Seed the injury baseline so the first run does not treat the entire
  // existing injury report as breaking news.
  try {
    const seed = await getInjuries();
    injurySnapshot = injuryEvents(seed, new Map()).snapshot;
    log.info(`seeded injury baseline with ${injurySnapshot.size} players`);
  } catch (e) {
    log.warn('could not seed injury baseline; first pass may be noisy', String(e));
  }

  let consecutiveFailures = 0;

  for (;;) {
    if (stopping) {
      log.info('watcher stopping');
      return;
    }
    const started = Date.now();
    try {
      await iterate(opts);
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures++;
      log.error(`iteration failed (${consecutiveFailures} in a row)`, e instanceof Error ? e.message : String(e));
      if (consecutiveFailures === 5) {
        await notify({
          severity: 'info',
          title: 'Fantasy watcher is struggling',
          body: `Five consecutive failures. Latest: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    if (opts.once) return;

    // Back off on repeated failure rather than hammering a broken endpoint.
    const penalty = Math.min(consecutiveFailures, 5) * 30_000;
    const elapsed = Date.now() - started;
    const wait = Math.max(5_000, intervalMs + penalty - elapsed);
    await sleep(wait);
  }
}

async function iterate(opts: WatchOptions): Promise<void> {
  const strategy = loadStrategy();
  const state = loadState();

  // --- 1. Poll the free feeds ---------------------------------------------
  const [news, injuries] = await Promise.all([
    getNews(50).catch((e) => {
      log.warn('news poll failed', String(e));
      return [];
    }),
    getInjuries().catch((e) => {
      log.warn('injury poll failed', String(e));
      return [];
    }),
  ]);

  const { events: injuryChanges, snapshot } = injuryEvents(injuries, injurySnapshot);
  if (snapshot.size) injurySnapshot = snapshot;

  const candidates = [...injuryChanges, ...newsEvents(news, strategy.execution.maxNewsAgeMinutes)];
  const fresh = candidates.filter((e) => !hasSeen(e.hash, state));

  if (!fresh.length) {
    log.debug('no new material events');
    await checkTrades(opts.leagueKey);
    return;
  }

  log.info(`${fresh.length} new material event(s)`);
  for (const e of fresh) log.info(`  • ${e.headline}`);

  // --- 2. Build the league picture ----------------------------------------
  // Only now, once we know something happened, do we spend Yahoo calls.
  const ctx = await buildContext({ leagueKey: opts.leagueKey, force: true });
  const season = Number(ctx.settings.league.season) || new Date().getFullYear();

  // --- 3. Work out who benefits -------------------------------------------
  const signals: RoleSignal[] = [];
  for (const event of fresh) {
    markSeen(event.hash, state);

    const mine = affectsMyRoster(event, ctx);
    if (mine) {
      log.info(`event concerns my player ${mine.name}`);
      await notify({
        severity: 'info',
        title: `Your player: ${mine.name}`,
        body: event.headline,
      });
    }

    try {
      signals.push(...(await beneficiaries(event, ctx, season)));
    } catch (e) {
      log.warn(`could not resolve beneficiaries for "${event.headline}"`, String(e));
    }
  }
  saveState(state);

  if (signals.length) {
    log.info(`${signals.length} role signal(s): ${signals.map((s) => s.source).join(' | ')}`);
  }

  // --- 4. Plan -------------------------------------------------------------
  const plan = planMoves(ctx, signals);
  logPlan(plan);

  if (plan.blockedBy) {
    log.warn(`plan blocked: ${plan.blockedBy}`);
    return;
  }
  if (!plan.moves.length) return;

  // --- 5. Execute ----------------------------------------------------------
  if (opts.planOnly) {
    log.info('planOnly set; not executing');
    return;
  }

  const results = await executePlan(ctx, plan);
  for (const r of results) {
    if (r.error) {
      await notify({
        severity: 'info',
        title: `Move failed: ${r.move.add.name}`,
        body: `${r.move.rationale}\n\nError: ${r.error}`,
      });
      continue;
    }
    await notify({
      severity: 'action',
      title: `${r.outcome?.dryRun ? '[DRY RUN] ' : ''}${describeMove(r.move.kind)}: ${r.move.add.name}` +
        (r.move.drop ? ` (dropped ${r.move.drop.name})` : ''),
      body: r.move.rationale,
    });
  }

  await checkTrades(opts.leagueKey);
}

/**
 * Trades: detect, escalate, stop. This function deliberately has no path that
 * accepts, rejects or proposes anything — it only files an approval request.
 */
async function checkTrades(leagueKey?: string): Promise<void> {
  let trades;
  try {
    trades = await getPendingTrades(leagueKey);
  } catch (e) {
    log.debug('trade check failed', String(e));
    return;
  }

  const state = loadState();
  for (const trade of trades) {
    if (state.seenTransactions[trade.transactionKey] !== undefined) continue;
    state.seenTransactions[trade.transactionKey] = Date.now();

    const incoming = trade.players.filter((p) => p.destinationTeamKey === trade.tradeeTeamKey);
    const outgoing = trade.players.filter((p) => p.sourceTeamKey === trade.tradeeTeamKey);
    const summary =
      `Trade ${trade.transactionKey}: receive ${incoming.map((p) => p.name).join(', ') || '—'} / ` +
      `send ${outgoing.map((p) => p.name).join(', ') || '—'}`;

    const approval = requestApproval('trade', summary, {
      transactionKey: trade.transactionKey,
      traderTeamKey: trade.traderTeamKey,
      tradeeTeamKey: trade.tradeeTeamKey,
      players: trade.players,
      note: trade.tradeNote,
    });

    await notify({
      severity: 'approval',
      title: 'Trade needs your decision',
      body: `${summary}\n${trade.tradeNote ? `Note: ${trade.tradeNote}\n` : ''}` +
        `Nothing has been accepted or rejected — this is waiting on you.`,
      approvalId: approval.id,
    });
  }
  saveState(state);
}

function describeMove(kind: string): string {
  if (kind === 'waiverClaim') return 'Waiver claim filed';
  if (kind === 'addDrop') return 'Add/drop executed';
  return 'Player added';
}

function logPlan(plan: Plan): void {
  if (!plan.moves.length && !plan.rejected.length) return;
  log.info(`plan for week ${plan.week} (priority #${plan.myPriority}):`);
  for (const m of plan.moves) {
    log.info(`  ✓ ${m.kind} ${m.add.name}${m.drop ? ` / drop ${m.drop.name}` : ''} (+${m.valueAdded} pts/gm)`);
  }
  for (const r of plan.rejected.slice(0, 8)) {
    log.debug(`  ✗ ${r.name}: ${r.reason}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reset module state between tests. */
export function resetWatcher(): void {
  injurySnapshot = new Map();
  stopping = false;
  invalidateContext();
}
