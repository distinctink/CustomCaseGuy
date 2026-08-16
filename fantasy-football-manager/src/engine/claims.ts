/**
 * Waiver claim lifecycle: timing, and finding out what actually happened.
 *
 * Filing a claim and never checking the result leaves the system blind in the
 * way that matters most. If we won, our priority just dropped to last and every
 * subsequent claim decision is computed against a stale number. If we lost, the
 * player we wanted is gone and we should be looking at the next name down.
 *
 * Yahoo does not push results, and a processed claim stops appearing as a
 * pending transaction, so we reconcile by looking at where the player ended up.
 */

import { getPlayersByKeys, getRoster, getWaiverPriorities } from '../yahoo/read.js';
import type { Player, Team } from '../yahoo/types.js';
import {
  loadState, recordClaimOutcome, addToWatchlist, removeFromWatchlist,
  type ClaimOutcome, type WatcherState,
} from '../store/state.js';
import { logger } from '../util/log.js';

const log = logger('engine:claims');

/** A claim older than this that we still cannot resolve is written off. */
const CLAIM_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReconcileResult {
  won: ClaimOutcome[];
  lost: ClaimOutcome[];
  stillPending: string[];
  /** Our waiver priority after reconciliation, if it could be read. */
  currentPriority?: number;
}

/**
 * Work out how each pending claim resolved by checking where the player is now.
 *
 * Three possible answers:
 *   - on our roster            -> we won
 *   - owned by another team    -> we lost
 *   - still on waivers         -> not processed yet
 */
export async function reconcileClaims(opts: {
  leagueKey: string;
  myTeamKey: string;
}): Promise<ReconcileResult> {
  const state = loadState();
  const pending = Object.entries(state.pendingClaims);
  const result: ReconcileResult = { won: [], lost: [], stillPending: [] };
  if (!pending.length) return result;

  const playerKeys = pending.map(([, c]) => c.playerKey);

  let players: Player[] = [];
  let rosterKeys = new Set<string>();
  try {
    [players, rosterKeys] = await Promise.all([
      getPlayersByKeys(opts.leagueKey, playerKeys),
      getRoster(opts.myTeamKey).then((r) => new Set(r.players.map((p) => p.playerKey))),
    ]);
  } catch (e) {
    log.warn('could not reconcile claims this pass', String(e));
    result.stillPending = pending.map(([key]) => key);
    return result;
  }

  const byKey = new Map(players.map((p) => [p.playerKey, p]));

  for (const [transactionKey, claim] of pending) {
    const player = byKey.get(claim.playerKey);
    const ownership = player?.ownership;

    if (rosterKeys.has(claim.playerKey)) {
      const outcome: ClaimOutcome = {
        at: Date.now(), transactionKey, playerKey: claim.playerKey,
        playerName: claim.playerName, result: 'won',
      };
      recordClaimOutcome(outcome, state);
      removeFromWatchlist(claim.playerKey, state);
      result.won.push(outcome);
      log.info(`claim won: ${claim.playerName}`);
      continue;
    }

    // Still sitting on waivers means the run has not happened yet.
    if (ownership === 'waivers') {
      result.stillPending.push(transactionKey);
      continue;
    }

    // Anything else — owned by a rival, or back in the free-agent pool without
    // us getting him — means the claim did not land.
    if (ownership === 'team' || ownership === 'freeagents') {
      const outcome: ClaimOutcome = {
        at: Date.now(), transactionKey, playerKey: claim.playerKey,
        playerName: claim.playerName, result: 'lost',
      };
      recordClaimOutcome(outcome, state);
      result.lost.push(outcome);
      log.info(`claim lost: ${claim.playerName} (now ${ownership})`);

      // If he landed back in the free-agent pool we can still just take him.
      if (ownership === 'freeagents') {
        addToWatchlist({
          playerKey: claim.playerKey,
          playerName: claim.playerName,
          position: player?.displayPosition ?? '',
          clearsAt: Date.now(),
          valueAdded: 0,
          reason: 'claim did not process but the player is now a free agent',
        }, state);
      }
      continue;
    }

    if (Date.now() - claim.filedAt > CLAIM_STALE_MS) {
      const outcome: ClaimOutcome = {
        at: Date.now(), transactionKey, playerKey: claim.playerKey,
        playerName: claim.playerName, result: 'expired',
      };
      recordClaimOutcome(outcome, state);
      result.lost.push(outcome);
      log.warn(`claim for ${claim.playerName} went stale without resolving`);
      continue;
    }

    result.stillPending.push(transactionKey);
  }

  // Winning a claim moves us to the back of the queue, so re-read the truth
  // rather than trusting a cached number.
  if (result.won.length) {
    try {
      const order = await getWaiverPriorities(opts.leagueKey);
      result.currentPriority = order.find((t: Team) => t.teamKey === opts.myTeamKey)?.waiverPriority;
      log.info(`waiver priority is now #${result.currentPriority ?? '?'}`);
    } catch (e) {
      log.debug('could not re-read waiver priority', String(e));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Waiver timing
// ---------------------------------------------------------------------------

/**
 * When a player on waivers becomes a free agent.
 *
 * Yahoo gives a `waiver_date` (a calendar date, no time) on players sitting on
 * waivers. Claims process in the early hours of that date, so we treat the
 * clear moment as the start of that day in the league's local time and let the
 * caller apply a safety margin.
 */
export function clearTimeFor(player: Player, processingHourLocal = 3): number | undefined {
  if (!player.waiverDate) return undefined;
  // waiver_date is "YYYY-MM-DD". Parsing it as local midnight then adding the
  // processing hour avoids the UTC-shift bug that a bare Date.parse would give.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(player.waiverDate);
  if (!match) {
    const fallback = Date.parse(player.waiverDate);
    return Number.isFinite(fallback) ? fallback : undefined;
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), processingHourLocal, 0, 0, 0);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** Hours from now until this player clears waivers, or undefined if unknown. */
export function hoursUntilClear(player: Player, processingHourLocal = 3): number | undefined {
  const at = clearTimeFor(player, processingHourLocal);
  if (at === undefined) return undefined;
  return (at - Date.now()) / (60 * 60 * 1000);
}

/**
 * How long the watcher should wait before its next poll.
 *
 * Normally the configured interval, but it tightens as a watchlist player
 * approaches his clear time — free agents are first-come, so being a minute
 * late is the same as not trying.
 */
export function nextPollDelayMs(opts: {
  baseIntervalMs: number;
  msUntilNextClear?: number;
  /** How close to the clear time we switch to fast polling. */
  sprintWindowMs?: number;
  sprintIntervalMs?: number;
}): number {
  const { baseIntervalMs, msUntilNextClear } = opts;
  const sprintWindow = opts.sprintWindowMs ?? 10 * 60_000;
  const sprintInterval = opts.sprintIntervalMs ?? 15_000;

  if (msUntilNextClear === undefined || msUntilNextClear <= 0) return baseIntervalMs;
  if (msUntilNextClear > sprintWindow) {
    // Do not sleep straight past the moment we care about.
    return Math.min(baseIntervalMs, Math.max(sprintInterval, msUntilNextClear - sprintWindow));
  }
  return Math.min(baseIntervalMs, sprintInterval);
}

/** Watchlist entries that have been chased too long without success. */
export function pruneWatchlist(maxAttempts: number, maxAgeMs: number, state: WatcherState = loadState()): string[] {
  const dropped: string[] = [];
  for (const [key, entry] of Object.entries(state.watchlist)) {
    const tooOld = Date.now() - entry.addedAt > maxAgeMs;
    const exhausted = entry.attempts >= maxAttempts;
    if (tooOld || exhausted) {
      dropped.push(entry.playerName);
      delete state.watchlist[key];
    }
  }
  return dropped;
}
