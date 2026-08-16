/**
 * The always-on watcher.
 *
 * Each cycle:
 *   1. reconcile waiver claims we filed, so priority is never stale
 *   2. sprint on watchlist players whose waiver window just closed
 *   3. poll ESPN for material news
 *   4. rebuild the league picture, work out who benefits, plan, execute
 *   5. re-optimise the starting lineup
 *   6. surface trades — incoming and proposed — for human approval
 *
 * Failure policy: a bad poll must never kill the process. Every iteration is
 * wrapped, errors back off, and the loop keeps running through an ESPN outage
 * or a Yahoo hiccup.
 */

import { getNews, getInjuries, getScoreboard } from '../espn/api.js';
import { injuryEvents, newsEvents, beneficiaries, affectsMyRoster } from './events.js';
import { notify } from './notify.js';
import { buildContext, invalidateContext, type DecisionContext } from '../engine/context.js';
import { planMoves, executePlan, type RoleSignal, type Plan } from '../engine/decide.js';
import { optimiseLineup, changedSlotsOnly, lockedTeamsFromGames } from '../engine/lineup.js';
import { reconcileClaims, nextPollDelayMs, pruneWatchlist } from '../engine/claims.js';
import { generateTradeIdeas } from '../engine/trades.js';
import { getPendingTrades } from '../yahoo/read.js';
import { addDrop, setLineup } from '../yahoo/write.js';
import { requestApproval } from '../store/approvals.js';
import {
  loadState, saveState, markSeen, hasSeen, dueWatchlistEntries,
  recordWatchlistAttempt, removeFromWatchlist, msUntilNextClear, recordMove, movesInLastDay,
} from '../store/state.js';
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
let lastTradeSweep = 0;

/** Trade ideas are a slow-moving thing; do not regenerate them every 90 seconds. */
const TRADE_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function requestStop(): void {
  stopping = true;
}

export async function watch(opts: WatchOptions = {}): Promise<void> {
  const strategy = loadStrategy();
  const baseIntervalMs = Math.max(30, strategy.execution.pollIntervalSeconds) * 1000;

  log.info(
    `watcher starting: poll every ${strategy.execution.pollIntervalSeconds}s, ` +
      `max ${strategy.execution.maxTransactionsPerDay} moves/day, ` +
      `autoSetLineup=${strategy.execution.autoSetLineup}, ` +
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

    const penalty = Math.min(consecutiveFailures, 5) * 30_000;
    const elapsed = Date.now() - started;
    // Tighten the cadence when a watchlist player is about to clear waivers —
    // free agents are first come, so being a cycle late is the same as not
    // trying at all.
    const target = nextPollDelayMs({
      baseIntervalMs,
      msUntilNextClear: msUntilNextClear(),
      sprintWindowMs: strategy.execution.sprintWindowMinutes * 60_000,
      sprintIntervalMs: strategy.execution.sprintIntervalSeconds * 1000,
    });
    const wait = Math.max(5_000, target + penalty - elapsed);
    await sleep(wait);
  }
}

async function iterate(opts: WatchOptions): Promise<void> {
  const strategy = loadStrategy();
  const state = loadState();

  // --- 1. Reconcile anything we filed last run ----------------------------
  await reconcile(opts);

  // --- 2. Grab watchlist players whose waivers just cleared ---------------
  await sprintWatchlist(opts);

  // --- 3. Poll the free feeds ---------------------------------------------
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

  const dropped = pruneWatchlist(
    strategy.execution.maxWatchlistAttempts,
    strategy.execution.watchlistTtlHours * 60 * 60 * 1000,
    state,
  );
  if (dropped.length) {
    log.info(`dropped from watchlist: ${dropped.join(', ')}`);
    saveState(state);
  }

  if (!fresh.length) {
    log.debug('no new material events');
    // Lineups still drift with injury designations even when nothing is
    // "material", so keep them honest on a quiet cycle too.
    await maintainLineup(opts, false);
    await checkTrades(opts.leagueKey);
    return;
  }

  log.info(`${fresh.length} new material event(s)`);
  for (const e of fresh) log.info(`  • ${e.headline}`);

  // --- 4. Build the league picture ----------------------------------------
  const ctx = await buildContext({ leagueKey: opts.leagueKey, force: true });
  const season = Number(ctx.settings.league.season) || new Date().getFullYear();

  const signals: RoleSignal[] = [];
  for (const event of fresh) {
    markSeen(event.hash, state);

    const mine = affectsMyRoster(event, ctx);
    if (mine) {
      log.info(`event concerns my player ${mine.name}`);
      await notify({ severity: 'info', title: `Your player: ${mine.name}`, body: event.headline });
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

  // --- 5. Plan and execute -------------------------------------------------
  const plan = planMoves(ctx, signals);
  logPlan(plan);

  if (!plan.blockedBy && plan.moves.length && !opts.planOnly) {
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
  } else if (plan.blockedBy) {
    log.warn(`plan blocked: ${plan.blockedBy}`);
  }

  // --- 6. Lineup and trades ------------------------------------------------
  await maintainLineup(opts, true);
  await checkTrades(opts.leagueKey);
  await suggestTrades(opts, ctx);
}

// ---------------------------------------------------------------------------
// Claim reconciliation
// ---------------------------------------------------------------------------

async function reconcile(opts: WatchOptions): Promise<void> {
  const state = loadState();
  if (!Object.keys(state.pendingClaims).length) return;

  try {
    const ctx = await buildContext({ leagueKey: opts.leagueKey, skipRivalRosters: true });
    const result = await reconcileClaims({ leagueKey: ctx.leagueKey, myTeamKey: ctx.myTeam.teamKey });

    for (const won of result.won) {
      // Winning drops us to the back of the queue, so the cached context is
      // wrong about the one number the whole strategy turns on.
      invalidateContext();
      await notify({
        severity: 'action',
        title: `Waiver claim won: ${won.playerName}`,
        body: `The claim processed successfully. Waiver priority is now #${result.currentPriority ?? 'unknown'}.`,
      });
    }
    for (const lost of result.lost) {
      await notify({
        severity: 'info',
        title: `Waiver claim lost: ${lost.playerName}`,
        body: 'Another manager had better priority. Priority is unchanged and still available.',
      });
    }
  } catch (e) {
    log.warn('claim reconciliation failed', String(e));
  }
}

// ---------------------------------------------------------------------------
// Watchlist sprint — the payoff for choosing not to burn priority
// ---------------------------------------------------------------------------

async function sprintWatchlist(opts: WatchOptions): Promise<void> {
  const strategy = loadStrategy();
  const due = dueWatchlistEntries(strategy.execution.maxWatchlistAttempts);
  if (!due.length) return;

  if (movesInLastDay() >= strategy.execution.maxTransactionsPerDay) {
    log.warn('watchlist players are clear but the daily transaction cap is reached');
    return;
  }

  const ctx = await buildContext({ leagueKey: opts.leagueKey, force: true, skipRivalRosters: true });

  for (const entry of due) {
    recordWatchlistAttempt(entry.playerKey);

    const player = ctx.available.find((p) => p.playerKey === entry.playerKey);
    if (!player) {
      log.debug(`${entry.playerName} is no longer available; dropping from watchlist`);
      removeFromWatchlist(entry.playerKey);
      continue;
    }
    // Still on waivers means the run has not happened yet — try again later.
    if (player.ownership === 'waivers') continue;

    const drop = ctx.rosterAnalysis.hasOpenSpot ? undefined : ctx.rosterAnalysis.droppable[0];
    if (!ctx.rosterAnalysis.hasOpenSpot && !drop) {
      log.warn(`${entry.playerName} has cleared but nothing is safely droppable`);
      continue;
    }

    if (opts.planOnly) {
      log.info(`planOnly: would grab ${entry.playerName} now that he has cleared`);
      continue;
    }

    try {
      const outcome = await addDrop({
        leagueKey: ctx.leagueKey,
        teamKey: ctx.myTeam.teamKey,
        addPlayerKey: entry.playerKey,
        dropPlayerKey: drop?.player.playerKey,
      });

      recordMove({
        at: Date.now(),
        kind: drop ? 'addDrop' : 'add',
        addPlayerKey: entry.playerKey,
        addPlayerName: entry.playerName,
        dropPlayerKey: drop?.player.playerKey,
        dropPlayerName: drop?.player.name,
        reason: `watchlist pickup after clearing waivers — ${entry.reason}`,
        transactionKey: outcome.transactionKey,
        dryRun: outcome.dryRun,
      });
      removeFromWatchlist(entry.playerKey);
      invalidateContext();

      await notify({
        severity: 'action',
        title: `${outcome.dryRun ? '[DRY RUN] ' : ''}Grabbed ${entry.playerName} as a free agent`,
        body: `Waited rather than burning priority, and picked him up for nothing once he cleared. ` +
          `Expected gain ${entry.valueAdded} pts/gm.` + (drop ? ` Dropped ${drop.player.name}.` : ''),
      });
    } catch (e) {
      log.warn(`could not grab ${entry.playerName}`, String(e));
    }
  }
}

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

async function maintainLineup(opts: WatchOptions, forceRebuild: boolean): Promise<void> {
  const strategy = loadStrategy();
  if (!strategy.execution.autoSetLineup) return;

  try {
    const ctx = await buildContext({ leagueKey: opts.leagueKey, force: forceRebuild, skipRivalRosters: true });
    if (!ctx.roster.isEditable) {
      log.debug('roster is not editable right now');
      return;
    }

    // Players whose game has kicked off cannot be moved, and attempting it
    // fails the whole request rather than just that player.
    let lockedTeams = new Set<string>();
    try {
      lockedTeams = lockedTeamsFromGames(await getScoreboard());
    } catch (e) {
      log.debug('could not read game states; assuming nothing is locked', String(e));
    }

    const plan = optimiseLineup({
      roster: ctx.roster,
      valuations: ctx.valuations,
      settings: ctx.settings,
      week: ctx.currentWeek,
      lockedTeams,
    });

    for (const note of plan.notes) log.warn(`lineup: ${note}`);
    if (!plan.changes.length) return;

    if (plan.gain < strategy.execution.minLineupGain) {
      log.debug(`lineup gain ${plan.gain} below threshold; leaving it alone`);
      return;
    }

    log.info(`lineup: ${plan.changes.length} change(s) worth ${plan.gain} pts`);
    for (const c of plan.changes) log.info(`  ${c.name}: ${c.from} → ${c.to} (${c.reason})`);

    if (opts.planOnly) return;

    const outcome = await setLineup({
      teamKey: ctx.myTeam.teamKey,
      week: ctx.currentWeek,
      slots: changedSlotsOnly(plan),
    });

    recordMove({
      at: Date.now(),
      kind: 'setLineup',
      reason: plan.changes.map((c) => `${c.name} ${c.from}→${c.to}`).join('; '),
      dryRun: outcome.dryRun,
    });
    invalidateContext();

    await notify({
      severity: 'action',
      title: `${outcome.dryRun ? '[DRY RUN] ' : ''}Lineup updated (+${plan.gain} projected)`,
      body: plan.changes.map((c) => `${c.name}: ${c.from} → ${c.to} — ${c.reason}`).join('\n'),
    });
  } catch (e) {
    log.warn('lineup maintenance failed', String(e));
  }
}

// ---------------------------------------------------------------------------
// Trades — detect and propose, never execute
// ---------------------------------------------------------------------------

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

/**
 * Look for trades worth proposing. These are filed as approval requests and
 * alerted; nothing is sent to Yahoo without you approving it first.
 */
async function suggestTrades(opts: WatchOptions, ctx: DecisionContext): Promise<void> {
  const strategy = loadStrategy();
  if (!strategy.execution.suggestTrades) return;
  if (Date.now() - lastTradeSweep < TRADE_SWEEP_INTERVAL_MS) return;
  lastTradeSweep = Date.now();

  const me = ctx.profiles.get(ctx.myTeam.teamKey);
  if (!me) return;

  const rivals = [...ctx.profiles.values()].filter((p) => p.teamKey !== ctx.myTeam.teamKey);
  if (!rivals.length) return;

  const blocked = new Set(
    ctx.rosterAnalysis.candidates.filter((c) => !c.droppable && c.blockers.some(
      (b) => b.includes('never-drop') || b.includes('undroppable'),
    )).map((c) => c.player.playerKey),
  );

  const ideas = generateTradeIdeas({
    me,
    rivals,
    valuations: ctx.valuations,
    strategy,
    untouchable: (p) => blocked.has(p.playerKey),
  });

  for (const idea of ideas) {
    const approval = requestApproval(
      'trade',
      `Propose to ${idea.theirTeamName}: send ${idea.send.map((p) => p.name).join(', ')} / ` +
        `receive ${idea.receive.map((p) => p.name).join(', ')}`,
      {
        leagueKey: ctx.leagueKey,
        myTeamKey: ctx.myTeam.teamKey,
        theirTeamKey: idea.theirTeamKey,
        sendPlayerKeys: idea.send.map((p) => p.playerKey),
        receivePlayerKeys: idea.receive.map((p) => p.playerKey),
        rationale: idea.rationale,
        myGain: idea.myGain,
        theirGain: idea.theirGain,
      },
    );

    // requestApproval collapses duplicates, so only alert on genuinely new ones.
    if (approval.createdAt < Date.now() - 5000) continue;

    await notify({
      severity: 'approval',
      title: `Trade idea: ${idea.send.map((p) => p.name).join(', ')} → ${idea.receive.map((p) => p.name).join(', ')}`,
      body: `${idea.rationale}\n\nMy gain ${idea.myGain} pts/gm, theirs ${idea.theirGain}. ` +
        `Estimated acceptance ${Math.round(idea.acceptability * 100)}%.\n` +
        `Nothing has been sent — this needs your approval first.`,
      approvalId: approval.id,
    });
  }
}

// ---------------------------------------------------------------------------

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
  lastTradeSweep = 0;
  invalidateContext();
}
