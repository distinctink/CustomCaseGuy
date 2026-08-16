import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_STRATEGY, type StrategyConfig } from '../src/config.js';
import { analyseRoster, wouldKeepLineupFillable, maxRosterSize, chooseDropForAdd } from '../src/engine/roster.js';
import { valuePlayer, primaryFantasyPosition, type Valuation } from '../src/engine/valuation.js';
import { scoreStats } from '../src/engine/scoring.js';
import type { LeagueSettings, Player, Roster } from '../src/yahoo/types.js';
import { resetStateCache } from '../src/store/state.js';

const strategy: StrategyConfig = structuredClone(DEFAULT_STRATEGY);

const settings: LeagueSettings = {
  league: {
    leagueKey: '461.l.1', leagueId: '1', name: 'Test', numTeams: 12, currentWeek: 5,
    startWeek: 1, endWeek: 17, season: '2025', waiverType: 'R', waiverRule: 'gametime',
    usesFaab: false, scoringType: 'head', isFinished: false,
  },
  rosterSlots: [
    { position: 'QB', count: 1 }, { position: 'RB', count: 2 }, { position: 'WR', count: 2 },
    { position: 'TE', count: 1 }, { position: 'W/R/T', count: 1 }, { position: 'K', count: 1 },
    { position: 'DEF', count: 1 }, { position: 'BN', count: 6 }, { position: 'IR', count: 1 },
  ],
  statCategories: [
    { statId: 11, name: 'Receptions', displayName: 'Rec', positionTypes: ['O'], enabled: true },
    { statId: 12, name: 'Reception Yards', displayName: 'Rec Yds', positionTypes: ['O'], enabled: true },
    { statId: 13, name: 'Reception TD', displayName: 'Rec TD', positionTypes: ['O'], enabled: true },
  ],
  statModifiers: new Map([[11, 1], [12, 0.1], [13, 6]]),
  startingSlots: [
    { position: 'QB', count: 1 }, { position: 'RB', count: 2 }, { position: 'WR', count: 2 },
    { position: 'TE', count: 1 }, { position: 'W/R/T', count: 1 }, { position: 'K', count: 1 },
    { position: 'DEF', count: 1 },
  ],
  benchCount: 6,
  irCount: 1,
};

let seq = 0;
function mk(name: string, pos: string, slot: string, over: Partial<Player> = {}): Player {
  const eligible = pos === 'RB' || pos === 'WR' || pos === 'TE' ? [pos, 'W/R/T'] : [pos];
  return {
    playerKey: `461.p.${++seq}`, playerId: String(seq), name,
    firstName: name.split(' ')[0]!, lastName: name.split(' ')[1] ?? '',
    team: 'KC', displayPosition: pos, primaryPosition: pos, positionType: 'O',
    eligiblePositions: eligible, status: '', onDisabledList: false,
    isUndroppable: false, ranks: [], selectedPosition: slot, ...over,
  };
}

function valuationsFor(players: Player[], ppg: Record<string, number>): Map<string, Valuation> {
  const m = new Map<string, Valuation>();
  for (const p of players) {
    m.set(p.playerKey, valuePlayer(
      { player: p, seasonPPG: ppg[p.name] ?? 5, recentPPG: ppg[p.name] ?? 5, gamesPlayed: 4, currentWeek: 5 },
      settings, strategy,
    ));
  }
  return m;
}

/** A maxed roster: 9 legal starters plus a full 6-man bench (15 = maxRosterSize). */
function fullRoster(): Player[] {
  return [
    mk('Star QB', 'QB', 'QB'),
    mk('Rb One', 'RB', 'RB'), mk('Rb Two', 'RB', 'RB'),
    mk('Wr One', 'WR', 'WR'), mk('Wr Two', 'WR', 'WR'),
    mk('Te One', 'TE', 'TE'),
    mk('Flex Guy', 'RB', 'W/R/T'),
    mk('Kicker Man', 'K', 'K'),
    mk('Defense Unit', 'DEF', 'DEF'),
    mk('Bench Rb', 'RB', 'BN'), mk('Bench Wr', 'WR', 'BN'), mk('Scrub Wr', 'WR', 'BN'),
    mk('Bench Qb', 'QB', 'BN'), mk('Bench Te', 'TE', 'BN'), mk('Deep Wr', 'WR', 'BN'),
  ];
}

function roster(players: Player[]): Roster {
  return { teamKey: '461.l.1.t.1', week: 5, isEditable: true, players };
}

test.beforeEach(() => resetStateCache());

test('maxRosterSize excludes IR slots', () => {
  assert.equal(maxRosterSize(settings), 15, '9 starters + 6 bench, IR not counted');
});

test('a starter is never droppable', () => {
  const players = fullRoster();
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, {}), settings, strategy,
  });
  const starter = analysis.candidates.find((c) => c.player.name === 'Star QB')!;
  assert.equal(starter.droppable, false);
  assert.match(starter.blockers.join(' '), /currently starting/);
});

test('Yahoo undroppable flag and the never-drop list both block a drop', () => {
  const players = fullRoster();
  players.push(mk('Protected Star', 'WR', 'BN', { isUndroppable: true }));
  players.push(mk('My Favourite', 'WR', 'BN'));
  const local = { ...strategy, neverDrop: ['My Favourite'] };

  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, {}), settings, strategy: local,
  });

  assert.match(
    analysis.candidates.find((c) => c.player.name === 'Protected Star')!.blockers.join(' '),
    /undroppable/,
  );
  assert.match(
    analysis.candidates.find((c) => c.player.name === 'My Favourite')!.blockers.join(' '),
    /never-drop/,
  );
});

test('position floors stop us from gutting a position', () => {
  const players = fullRoster();
  // Floor for TE is 1 and we hold exactly one, so it must be protected.
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, {}), settings, strategy,
  });
  const te = analysis.candidates.find((c) => c.player.name === 'Te One')!;
  assert.equal(te.droppable, false);
  assert.ok(te.blockers.some((b) => /floor|starting/.test(b)));
});

test('droppable players are ordered worst-value first', () => {
  const players = fullRoster();
  const ppg = { 'Bench Rb': 9, 'Bench Wr': 6, 'Scrub Wr': 1 };
  const local = { ...strategy, positionFloors: { ...strategy.positionFloors, WR: 2, RB: 2 } };
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, ppg), settings, strategy: local,
  });

  assert.ok(analysis.droppable.length > 0);
  assert.equal(analysis.droppable[0]!.player.name, 'Scrub Wr', 'lowest value goes first');
});

test('dropFirst overrides value ordering', () => {
  const players = fullRoster();
  const ppg = { 'Bench Rb': 9, 'Bench Wr': 6, 'Scrub Wr': 1 };
  const local = {
    ...strategy,
    dropFirst: ['Bench Rb'],
    positionFloors: { ...strategy.positionFloors, WR: 2, RB: 2 },
  };
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, ppg), settings, strategy: local,
  });
  assert.equal(analysis.droppable[0]!.player.name, 'Bench Rb');
});

test('lineup feasibility rejects a drop that leaves a slot unfillable', () => {
  // Exactly one kicker: dropping them means the K slot cannot be filled.
  const players = fullRoster();
  const kicker = players.find((p) => p.name === 'Kicker Man')!;
  assert.equal(wouldKeepLineupFillable(kicker, players, settings), false);

  const scrub = players.find((p) => p.name === 'Scrub Wr')!;
  assert.equal(wouldKeepLineupFillable(scrub, players, settings), true);
});

test('lineup feasibility does not let a flex slot steal a dedicated-slot player', () => {
  // Two WRs and one flex-eligible RB: WR/WR/flex must all fill.
  const players = [
    mk('Qb', 'QB', 'QB'), mk('Rb A', 'RB', 'RB'), mk('Rb B', 'RB', 'RB'),
    mk('Wr A', 'WR', 'WR'), mk('Wr B', 'WR', 'WR'), mk('Te A', 'TE', 'TE'),
    mk('Rb C', 'RB', 'W/R/T'), mk('K', 'K', 'K'), mk('Def', 'DEF', 'DEF'),
  ];
  const spare = mk('Spare Wr', 'WR', 'BN');
  assert.equal(wouldKeepLineupFillable(spare, [...players, spare], settings), true);
  // Removing a dedicated WR leaves WR/WR unfillable even though a flex RB exists.
  assert.equal(wouldKeepLineupFillable(players.find((p) => p.name === 'Wr A')!, players, settings), false);
});

test('IR players do not count against the roster limit', () => {
  const players = fullRoster();
  players.push(mk('Hurt Guy', 'WR', 'IR', { status: 'IR' }));
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, {}), settings, strategy,
  });
  assert.equal(analysis.rosterSize, 15, 'the IR player is excluded from the active count');
  assert.equal(analysis.hasOpenSpot, false, 'a maxed roster with an IR stash is still full');
});

test('an open roster spot means no drop is required', () => {
  const players = fullRoster().slice(0, 10);
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, {}), settings, strategy,
  });
  assert.equal(analysis.hasOpenSpot, true);

  const incoming = valuePlayer(
    { player: mk('New Guy', 'WR', 'BN'), seasonPPG: 8, recentPPG: 8, currentWeek: 5 },
    settings, strategy,
  );
  const pairing = chooseDropForAdd(analysis, incoming, strategy)!;
  assert.equal(pairing.drop, undefined);
  assert.equal(pairing.valueAdded, incoming.projectedPPG, 'full value when nothing is given up');
});

test('value added is measured against the player actually being dropped', () => {
  const players = fullRoster();
  const ppg = { 'Bench Rb': 9, 'Bench Wr': 6, 'Scrub Wr': 2 };
  const local = { ...strategy, positionFloors: { ...strategy.positionFloors, WR: 2, RB: 2 } };
  const analysis = analyseRoster({
    roster: roster(players), valuations: valuationsFor(players, ppg), settings, strategy: local,
  });
  const incoming = valuePlayer(
    { player: mk('Hot Pickup', 'WR', 'BN'), seasonPPG: 10, recentPPG: 10, currentWeek: 5 },
    settings, strategy,
  );
  const pairing = chooseDropForAdd(analysis, incoming, local)!;
  assert.equal(pairing.drop!.player.name, 'Scrub Wr');
  assert.equal(pairing.valueAdded, 8, '10 ppg incoming minus 2 ppg outgoing');
});

// --- Valuation and scoring --------------------------------------------------

test('scoring uses the league modifiers, so PPR settings change the answer', () => {
  const statline = new Map([[11, 7], [12, 80], [13, 1]]); // 7 rec, 80 yds, 1 TD
  assert.equal(scoreStats(statline, settings), 21, 'PPR: 7 + 8 + 6');

  const halfPpr: LeagueSettings = { ...settings, statModifiers: new Map([[11, 0.5], [12, 0.1], [13, 6]]) };
  assert.equal(scoreStats(statline, halfPpr), 17.5);
});

test('an Out designation zeroes a player out', () => {
  const v = valuePlayer(
    { player: mk('Hurt Star', 'RB', 'BN', { status: 'O' }), seasonPPG: 15, recentPPG: 15, currentWeek: 5 },
    settings, strategy,
  );
  assert.equal(v.projectedPPG, 0);
});

test('a role-change bonus lifts a backup into startable range', () => {
  const backup = mk('Backup Rb', 'RB', 'BN');
  const before = valuePlayer({ player: backup, seasonPPG: 3, recentPPG: 3, currentWeek: 5 }, settings, strategy);
  const after = valuePlayer(
    { player: backup, seasonPPG: 3, recentPPG: 3, roleChange: 'starter_out_backup_promoted', currentWeek: 5 },
    settings, strategy,
  );
  assert.ok(after.projectedPPG > before.projectedPPG + 5, 'promotion is worth about six points a game');
});

test('positional scarcity only affects the comparison value, not raw points', () => {
  const rb = valuePlayer({ player: mk('Rb X', 'RB', 'BN'), seasonPPG: 10, recentPPG: 10, currentWeek: 5 }, settings, strategy);
  const k = valuePlayer({ player: mk('Kicker X', 'K', 'BN'), seasonPPG: 10, recentPPG: 10, currentWeek: 5 }, settings, strategy);
  assert.equal(rb.projectedPPG, k.projectedPPG);
  assert.ok(rb.adjustedValue > k.adjustedValue, 'a 10-point RB is worth more than a 10-point kicker');
});

test('primary position ignores flex eligibility', () => {
  assert.equal(primaryFantasyPosition(mk('Flex Rb', 'RB', 'W/R/T')), 'RB');
});
