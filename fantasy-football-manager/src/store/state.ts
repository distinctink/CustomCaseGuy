/**
 * Durable watcher state: which news we have already acted on, what we have
 * done recently, and the rate/anti-churn ledgers.
 *
 * A flat JSON file is enough here — the write volume is a handful of records a
 * week, and being able to read and hand-edit it is worth more than a database.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { env } from '../config.js';
import { logger } from '../util/log.js';

const log = logger('state');

export interface ExecutedMove {
  at: number;
  kind: 'add' | 'drop' | 'addDrop' | 'waiverClaim' | 'setLineup';
  addPlayerKey?: string;
  addPlayerName?: string;
  dropPlayerKey?: string;
  dropPlayerName?: string;
  reason: string;
  transactionKey?: string;
  dryRun: boolean;
}

export interface WatcherState {
  /** Hashes of news items already processed, with the time we saw them. */
  seenEvents: Record<string, number>;
  /** Transactions we executed, newest last. */
  moves: ExecutedMove[];
  /** playerKey -> unix ms we added them, for the min-hold rule. */
  acquiredAt: Record<string, number>;
  /** Yahoo transaction ids we have already reacted to (rival drops etc). */
  seenTransactions: Record<string, number>;
  /** Last time we pulled the free-agent pool. */
  lastFaRefresh: number;
  /** Pending waiver claims we filed: transactionKey -> summary. */
  pendingClaims: Record<string, { playerKey: string; playerName: string; filedAt: number; reason: string }>;
  /**
   * Players we deliberately let clear rather than claiming. Once waivers
   * process, these become first-come free agents, so the watcher polls hard
   * around `clearsAt` to grab them ahead of the other managers.
   */
  watchlist: Record<string, WatchlistEntry>;
  /** Outcomes of claims we filed, for tuning and for the activity log. */
  claimOutcomes: ClaimOutcome[];
}

export interface WatchlistEntry {
  playerKey: string;
  playerName: string;
  position: string;
  /** Unix ms when the player is expected to clear waivers. */
  clearsAt: number;
  /** Points per game we expected to gain. */
  valueAdded: number;
  reason: string;
  addedAt: number;
  /** Attempts made since the clear time, to bound retries. */
  attempts: number;
}

export interface ClaimOutcome {
  at: number;
  transactionKey: string;
  playerKey: string;
  playerName: string;
  result: 'won' | 'lost' | 'expired';
  /** Our waiver priority when the claim was filed. */
  filedAtPriority?: number;
}

const EMPTY: WatcherState = {
  seenEvents: {},
  moves: [],
  acquiredAt: {},
  seenTransactions: {},
  lastFaRefresh: 0,
  pendingClaims: {},
  watchlist: {},
  claimOutcomes: [],
};

/** Forget event hashes older than this so the file does not grow forever. */
const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MOVES = 500;

let cache: WatcherState | undefined;

export function loadState(path = env.statePath): WatcherState {
  if (cache) return cache;
  if (!existsSync(path)) {
    cache = structuredClone(EMPTY);
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<WatcherState>;
    cache = { ...structuredClone(EMPTY), ...parsed };
    return cache;
  } catch (e) {
    log.warn('state file unreadable, starting fresh', String(e));
    cache = structuredClone(EMPTY);
    return cache;
  }
}

export function saveState(state: WatcherState = loadState(), path = env.statePath): void {
  prune(state);
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename so a crash mid-write cannot truncate the ledger.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, path);
  cache = state;
}

function prune(state: WatcherState): void {
  const cutoff = Date.now() - EVENT_TTL_MS;
  for (const [k, t] of Object.entries(state.seenEvents)) {
    if (t < cutoff) delete state.seenEvents[k];
  }
  for (const [k, t] of Object.entries(state.seenTransactions)) {
    if (t < cutoff) delete state.seenTransactions[k];
  }
  if (state.moves.length > MAX_MOVES) {
    state.moves = state.moves.slice(-MAX_MOVES);
  }
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

export function eventHash(parts: unknown[]): string {
  return createHash('sha1').update(parts.map((p) => String(p)).join('|')).digest('hex').slice(0, 16);
}

/** True the first time we see this hash; records it as seen. */
export function markSeen(hash: string, state = loadState()): boolean {
  if (state.seenEvents[hash] !== undefined) return false;
  state.seenEvents[hash] = Date.now();
  return true;
}

export function hasSeen(hash: string, state = loadState()): boolean {
  return state.seenEvents[hash] !== undefined;
}

// ---------------------------------------------------------------------------
// Rate and churn limits
// ---------------------------------------------------------------------------

/** Transactions executed in the last 24 hours (dry runs excluded). */
export function movesInLastDay(state = loadState()): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return state.moves.filter((m) => m.at >= cutoff && !m.dryRun && m.kind !== 'setLineup').length;
}

export function recordMove(move: ExecutedMove, state = loadState()): void {
  state.moves.push(move);
  if (move.addPlayerKey && !move.dryRun) state.acquiredAt[move.addPlayerKey] = move.at;
  if (move.dropPlayerKey) delete state.acquiredAt[move.dropPlayerKey];
  saveState(state);
}

/** Hours since we acquired a player, or Infinity if we did not add them. */
export function hoursHeld(playerKey: string, state = loadState()): number {
  const at = state.acquiredAt[playerKey];
  if (at === undefined) return Infinity;
  return (Date.now() - at) / (60 * 60 * 1000);
}

export function recordPendingClaim(
  transactionKey: string,
  info: { playerKey: string; playerName: string; reason: string },
  state = loadState(),
): void {
  state.pendingClaims[transactionKey] = { ...info, filedAt: Date.now() };
  saveState(state);
}

export function clearPendingClaim(transactionKey: string, state = loadState()): void {
  delete state.pendingClaims[transactionKey];
  saveState(state);
}

/** Record how a filed claim actually resolved, and retire it. */
export function recordClaimOutcome(outcome: ClaimOutcome, state = loadState()): void {
  state.claimOutcomes.push(outcome);
  if (state.claimOutcomes.length > 100) state.claimOutcomes = state.claimOutcomes.slice(-100);
  delete state.pendingClaims[outcome.transactionKey];
  saveState(state);
}

// ---------------------------------------------------------------------------
// Free-agent watchlist
// ---------------------------------------------------------------------------

/**
 * Track a player we chose not to claim. Priority-league strategy only pays off
 * if we actually show up when he clears — otherwise "wait for free agency" is
 * just a decision to lose him to whoever is watching more closely.
 */
export function addToWatchlist(entry: Omit<WatchlistEntry, 'addedAt' | 'attempts'>, state = loadState()): void {
  const existing = state.watchlist[entry.playerKey];
  state.watchlist[entry.playerKey] = {
    ...entry,
    addedAt: existing?.addedAt ?? Date.now(),
    attempts: existing?.attempts ?? 0,
  };
  saveState(state);
}

export function removeFromWatchlist(playerKey: string, state = loadState()): void {
  delete state.watchlist[playerKey];
  saveState(state);
}

/** Watchlist entries whose clear time has arrived and that still have retries left. */
export function dueWatchlistEntries(maxAttempts: number, state = loadState()): WatchlistEntry[] {
  const now = Date.now();
  return Object.values(state.watchlist)
    .filter((e) => e.clearsAt <= now && e.attempts < maxAttempts)
    .sort((a, b) => b.valueAdded - a.valueAdded);
}

export function recordWatchlistAttempt(playerKey: string, state = loadState()): void {
  const entry = state.watchlist[playerKey];
  if (!entry) return;
  entry.attempts += 1;
  saveState(state);
}

/**
 * Milliseconds until the next watchlist entry clears, or undefined when the
 * list is empty. The watcher tightens its poll interval as this approaches so
 * we are first in line rather than up to a full cycle late.
 */
export function msUntilNextClear(state = loadState()): number | undefined {
  const upcoming = Object.values(state.watchlist)
    .map((e) => e.clearsAt - Date.now())
    .filter((ms) => ms > 0);
  return upcoming.length ? Math.min(...upcoming) : undefined;
}

/** Test hook. */
export function resetStateCache(): void {
  cache = undefined;
}
