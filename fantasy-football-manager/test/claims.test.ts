import test from 'node:test';
import assert from 'node:assert/strict';

import { clearTimeFor, hoursUntilClear, nextPollDelayMs, pruneWatchlist } from '../src/engine/claims.js';
import type { Player } from '../src/yahoo/types.js';
import type { WatcherState } from '../src/store/state.js';

function mk(over: Partial<Player> = {}): Player {
  return {
    playerKey: '461.p.1', playerId: '1', name: 'Waiver Guy', firstName: 'Waiver', lastName: 'Guy',
    team: 'KC', displayPosition: 'RB', primaryPosition: 'RB', positionType: 'O',
    eligiblePositions: ['RB'], status: '', onDisabledList: false, isUndroppable: false,
    ranks: [], ...over,
  };
}

// --- Clear timing -----------------------------------------------------------

test('waiver_date is interpreted in local time, not shifted by UTC', () => {
  const at = clearTimeFor(mk({ waiverDate: '2026-09-16' }), 3)!;
  const d = new Date(at);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8, 'September');
  assert.equal(d.getDate(), 16, 'the date must not roll backwards through a timezone conversion');
  assert.equal(d.getHours(), 3, 'processing hour is applied');
});

test('the processing hour is configurable', () => {
  const early = clearTimeFor(mk({ waiverDate: '2026-09-16' }), 0)!;
  const later = clearTimeFor(mk({ waiverDate: '2026-09-16' }), 6)!;
  assert.equal(later - early, 6 * 3600_000);
});

test('a player with no waiver date has no clear time', () => {
  assert.equal(clearTimeFor(mk()), undefined);
  assert.equal(hoursUntilClear(mk()), undefined);
});

test('hoursUntilClear is negative once the window has passed', () => {
  const yesterday = new Date(Date.now() - 36 * 3600_000);
  const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  assert.ok(hoursUntilClear(mk({ waiverDate: iso }), 3)! < 0);
});

// --- Adaptive polling -------------------------------------------------------

test('polling runs at the normal cadence when nothing is about to clear', () => {
  assert.equal(nextPollDelayMs({ baseIntervalMs: 90_000 }), 90_000);
  assert.equal(nextPollDelayMs({ baseIntervalMs: 90_000, msUntilNextClear: 0 }), 90_000);
});

test('polling sprints as a clear time approaches', () => {
  const delay = nextPollDelayMs({
    baseIntervalMs: 90_000,
    msUntilNextClear: 60_000,
    sprintWindowMs: 10 * 60_000,
    sprintIntervalMs: 15_000,
  });
  assert.equal(delay, 15_000, 'inside the sprint window we poll fast');
});

test('polling never sleeps straight past a clear time', () => {
  // 12 minutes out with a 10-minute sprint window: wake at the window edge,
  // not 90 seconds before the player is gone.
  const delay = nextPollDelayMs({
    baseIntervalMs: 90_000,
    msUntilNextClear: 12 * 60_000,
    sprintWindowMs: 10 * 60_000,
    sprintIntervalMs: 15_000,
  });
  assert.ok(delay <= 90_000);
  assert.ok(delay >= 15_000);
});

test('a far-off clear time does not slow the normal cadence', () => {
  const delay = nextPollDelayMs({
    baseIntervalMs: 90_000,
    msUntilNextClear: 48 * 3600_000,
    sprintWindowMs: 10 * 60_000,
  });
  assert.equal(delay, 90_000);
});

// --- Watchlist hygiene ------------------------------------------------------

function stateWith(entries: Record<string, { addedAt: number; attempts: number }>): WatcherState {
  return {
    seenEvents: {}, moves: [], acquiredAt: {}, seenTransactions: {},
    lastFaRefresh: 0, pendingClaims: {}, claimOutcomes: {} as never,
    watchlist: Object.fromEntries(
      Object.entries(entries).map(([k, v]) => [k, {
        playerKey: k, playerName: k, position: 'RB', clearsAt: Date.now(),
        valueAdded: 2, reason: 'test', addedAt: v.addedAt, attempts: v.attempts,
      }]),
    ),
  } as unknown as WatcherState;
}

test('watchlist entries are dropped once attempts are exhausted', () => {
  const state = stateWith({ tried: { addedAt: Date.now(), attempts: 20 } });
  const dropped = pruneWatchlist(20, 96 * 3600_000, state);
  assert.deepEqual(dropped, ['tried']);
  assert.equal(Object.keys(state.watchlist).length, 0);
});

test('watchlist entries are dropped once they go stale', () => {
  const state = stateWith({ old: { addedAt: Date.now() - 200 * 3600_000, attempts: 0 } });
  const dropped = pruneWatchlist(20, 96 * 3600_000, state);
  assert.deepEqual(dropped, ['old']);
});

test('live watchlist entries survive pruning', () => {
  const state = stateWith({ fresh: { addedAt: Date.now(), attempts: 1 } });
  assert.deepEqual(pruneWatchlist(20, 96 * 3600_000, state), []);
  assert.equal(Object.keys(state.watchlist).length, 1);
});
