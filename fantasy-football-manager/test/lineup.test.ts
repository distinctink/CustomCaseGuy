import test from 'node:test';
import assert from 'node:assert/strict';

import { maxWeightAssignment } from '../src/util/assignment.js';
import { optimiseLineup, changedSlotsOnly, lockedTeamsFromGames } from '../src/engine/lineup.js';
import { DEFAULT_STRATEGY, type StrategyConfig } from '../src/config.js';
import { valuePlayer, type Valuation } from '../src/engine/valuation.js';
import type { LeagueSettings, Player, Roster } from '../src/yahoo/types.js';

const strategy: StrategyConfig = structuredClone(DEFAULT_STRATEGY);

const settings: LeagueSettings = {
  league: {
    leagueKey: '461.l.1', leagueId: '1', name: 'Test', numTeams: 12, currentWeek: 5,
    startWeek: 1, endWeek: 17, season: '2025', waiverType: 'R', waiverRule: 'gametime',
    usesFaab: false, scoringType: 'head', isFinished: false,
  },
  rosterSlots: [],
  statCategories: [],
  statModifiers: new Map([[11, 1], [12, 0.1], [13, 6]]),
  startingSlots: [
    { position: 'QB', count: 1 }, { position: 'RB', count: 2 }, { position: 'WR', count: 2 },
    { position: 'TE', count: 1 }, { position: 'W/R/T', count: 1 },
  ],
  benchCount: 6,
  irCount: 1,
};

let seq = 0;
function mk(name: string, pos: string, slot: string, over: Partial<Player> = {}): Player {
  const eligible = ['RB', 'WR', 'TE'].includes(pos) ? [pos, 'W/R/T'] : [pos];
  return {
    playerKey: `461.p.${++seq}`, playerId: String(seq), name,
    firstName: name, lastName: '', team: 'KC', displayPosition: pos,
    primaryPosition: pos, positionType: 'O', eligiblePositions: eligible,
    status: '', onDisabledList: false, isUndroppable: false, ranks: [],
    selectedPosition: slot, ...over,
  };
}

function valuations(players: Player[], ppg: Record<string, number>): Map<string, Valuation> {
  const m = new Map<string, Valuation>();
  for (const p of players) {
    m.set(p.playerKey, valuePlayer(
      { player: p, seasonPPG: ppg[p.name] ?? 0, recentPPG: ppg[p.name] ?? 0, gamesPlayed: 4, currentWeek: 5 },
      settings, strategy,
    ));
  }
  return m;
}

const roster = (players: Player[]): Roster => ({
  teamKey: '461.l.1.t.1', week: 5, isEditable: true, players,
});

// --- Assignment primitive ---------------------------------------------------

test('assignment finds the optimum, not the greedy answer', () => {
  // Greedy grabs the single largest cell (9) and is then forced into 1, for 10.
  // The optimum takes 8 + 7 = 15 by giving up the biggest individual value.
  const weights = [
    [9, 8],
    [7, 1],
  ];
  const { rowToColumn, totalWeight } = maxWeightAssignment(weights);
  assert.equal(totalWeight, 15);
  assert.deepEqual(rowToColumn, [1, 0]);
});

test('assignment never selects a forbidden pairing', () => {
  const weights = [
    [Number.NEGATIVE_INFINITY, 5],
    [3, Number.NEGATIVE_INFINITY],
  ];
  const { rowToColumn, totalWeight } = maxWeightAssignment(weights);
  assert.deepEqual(rowToColumn, [1, 0]);
  assert.equal(totalWeight, 8);
});

test('assignment leaves a row unfilled when nothing is eligible', () => {
  const weights = [[Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]];
  const { rowToColumn } = maxWeightAssignment(weights);
  assert.deepEqual(rowToColumn, [-1]);
});

test('assignment handles more columns than rows', () => {
  const weights = [[1, 5, 3]];
  const { rowToColumn, totalWeight } = maxWeightAssignment(weights);
  assert.deepEqual(rowToColumn, [1]);
  assert.equal(totalWeight, 5);
});

// --- Lineup optimisation ----------------------------------------------------

test('an Out player is benched and the best replacement starts', () => {
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Hurt Rb', 'RB', 'RB', { status: 'O', statusFull: 'Out' }),
    mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'),
    mk('Flex Wr', 'WR', 'W/R/T'),
    mk('Bench Rb', 'RB', 'BN'),
  ];
  const ppg = {
    'Qb One': 18, 'Hurt Rb': 16, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11,
    'Te One': 9, 'Flex Wr': 8, 'Bench Rb': 7,
  };
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, ppg), settings, week: 5,
  });

  const benched = plan.changes.find((c) => c.name === 'Hurt Rb');
  assert.ok(benched, 'the Out player is moved');
  assert.equal(benched!.to, 'BN');
  assert.match(benched!.reason, /ruled Out/i);

  const promoted = plan.changes.find((c) => c.name === 'Bench Rb');
  assert.ok(promoted, 'the bench player comes in');
  assert.notEqual(promoted!.to, 'BN');
  assert.ok(plan.gain > 0, 'the change is an improvement');
});

test('the optimiser beats greedy when a flex slot would strand a dedicated one', () => {
  // Only one TE exists. A greedy fill by value would put him in the flex and
  // leave the TE slot empty.
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Rb One', 'RB', 'RB'), mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Only Te', 'TE', 'BN'),
    mk('Spare Wr', 'WR', 'BN'),
  ];
  const ppg = {
    'Qb One': 18, 'Rb One': 14, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11,
    'Only Te': 15, 'Spare Wr': 6,
  };
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, ppg), settings, week: 5,
  });

  const slotOf = (name: string) =>
    plan.slots.find((s) => s.playerKey === players.find((p) => p.name === name)!.playerKey)?.position;

  assert.equal(slotOf('Only Te'), 'TE', 'the sole tight end fills the TE slot, not the flex');
  assert.equal(slotOf('Spare Wr'), 'W/R/T', 'the flex takes the next best eligible body');
  assert.equal(plan.notes.length, 0, 'every slot is filled');
});

test('a bye-week player is benched', () => {
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Bye Rb', 'RB', 'RB', { byeWeek: 5 }),
    mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'), mk('Flex Wr', 'WR', 'W/R/T'),
    mk('Bench Rb', 'RB', 'BN'),
  ];
  const ppg = {
    'Qb One': 18, 'Bye Rb': 17, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11,
    'Te One': 9, 'Flex Wr': 8, 'Bench Rb': 6,
  };
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, ppg), settings, week: 5,
  });
  const change = plan.changes.find((c) => c.name === 'Bye Rb');
  assert.ok(change);
  assert.equal(change!.to, 'BN');
  assert.match(change!.reason, /bye/i);
});

test('players whose game has started are never moved', () => {
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Locked Rb', 'RB', 'RB', { status: 'O', team: 'BUF' }),
    mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'), mk('Flex Wr', 'WR', 'W/R/T'),
    mk('Bench Rb', 'RB', 'BN'),
  ];
  const ppg = { 'Qb One': 18, 'Locked Rb': 0, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11, 'Te One': 9, 'Flex Wr': 8, 'Bench Rb': 10 };

  const plan = optimiseLineup({
    roster: roster(players),
    valuations: valuations(players, ppg),
    settings,
    week: 5,
    lockedTeams: new Set(['BUF']),
  });

  assert.ok(plan.lockedOut.includes('Locked Rb'));
  assert.equal(plan.changes.find((c) => c.name === 'Locked Rb'), undefined,
    'a locked player keeps his slot even though he is worthless');
});

test('an already-optimal lineup produces no changes', () => {
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Rb One', 'RB', 'RB'), mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'), mk('Flex Wr', 'WR', 'W/R/T'),
    mk('Scrub', 'WR', 'BN'),
  ];
  const ppg = {
    'Qb One': 18, 'Rb One': 14, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11,
    'Te One': 9, 'Flex Wr': 8, 'Scrub': 2,
  };
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, ppg), settings, week: 5,
  });
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.gain, 0);
  assert.equal(changedSlotsOnly(plan).length, 0);
});

test('IR-slotted players are left out of the lineup problem entirely', () => {
  const players = [
    mk('Qb One', 'QB', 'QB'),
    mk('Rb One', 'RB', 'RB'), mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'), mk('Flex Wr', 'WR', 'W/R/T'),
    mk('Stashed', 'RB', 'IR', { status: 'IR' }),
  ];
  const ppg = { 'Qb One': 18, 'Rb One': 14, 'Rb Two': 12, 'Wr One': 13, 'Wr Two': 11, 'Te One': 9, 'Flex Wr': 8, Stashed: 0 };
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, ppg), settings, week: 5,
  });
  assert.equal(plan.slots.find((s) => s.playerKey === players[7]!.playerKey), undefined,
    'the IR player is not assigned a slot at all');
});

test('unfillable slots are reported rather than silently skipped', () => {
  const players = [mk('Qb One', 'QB', 'QB'), mk('Rb One', 'RB', 'RB')];
  const plan = optimiseLineup({
    roster: roster(players), valuations: valuations(players, { 'Qb One': 18, 'Rb One': 12 }), settings, week: 5,
  });
  assert.ok(plan.notes.length > 0);
  assert.match(plan.notes[0]!, /could not be filled/);
});

test('lockedTeamsFromGames flags in-progress and finished games only', () => {
  const locked = lockedTeamsFromGames([
    { state: 'pre', competitors: [{ team: 'KC' }, { team: 'DET' }] },
    { state: 'in', competitors: [{ team: 'BUF' }, { team: 'MIA' }] },
    { state: 'post', competitors: [{ team: 'PHI' }, { team: 'DAL' }] },
  ]);
  assert.equal(locked.has('KC'), false, 'a game that has not kicked off is still editable');
  assert.ok(locked.has('BUF') && locked.has('MIA'));
  assert.ok(locked.has('PHI') && locked.has('DAL'));
});
