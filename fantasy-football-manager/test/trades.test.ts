import test from 'node:test';
import assert from 'node:assert/strict';

import { requiredStarters, profileTeam, marginalValue, generateTradeIdeas } from '../src/engine/trades.js';
import { DEFAULT_STRATEGY, type StrategyConfig } from '../src/config.js';
import { valuePlayer, type Valuation } from '../src/engine/valuation.js';
import type { LeagueSettings, Player, Roster, Team } from '../src/yahoo/types.js';

const strategy: StrategyConfig = structuredClone(DEFAULT_STRATEGY);

const settings: LeagueSettings = {
  league: {
    leagueKey: '461.l.1', leagueId: '1', name: 'Test', numTeams: 12, currentWeek: 5,
    startWeek: 1, endWeek: 17, season: '2026', waiverType: 'R', waiverRule: 'gametime',
    usesFaab: false, scoringType: 'head', isFinished: false,
  },
  rosterSlots: [], statCategories: [], statModifiers: new Map([[11, 1]]),
  startingSlots: [
    { position: 'QB', count: 1 }, { position: 'RB', count: 2 },
    { position: 'WR', count: 2 }, { position: 'TE', count: 1 },
    { position: 'W/R/T', count: 1 },
  ],
  benchCount: 6, irCount: 1,
};

let seq = 0;
function mk(name: string, pos: string): Player {
  const eligible = ['RB', 'WR', 'TE'].includes(pos) ? [pos, 'W/R/T'] : [pos];
  return {
    playerKey: `461.p.${++seq}`, playerId: String(seq), name, firstName: name, lastName: '',
    team: 'KC', displayPosition: pos, primaryPosition: pos, positionType: 'O',
    eligiblePositions: eligible, status: '', onDisabledList: false, isUndroppable: false,
    ranks: [], selectedPosition: 'BN',
  };
}

const allValuations = new Map<string, Valuation>();
function value(p: Player, ppg: number): Player {
  allValuations.set(p.playerKey, valuePlayer(
    { player: p, seasonPPG: ppg, recentPPG: ppg, gamesPlayed: 4, currentWeek: 5 }, settings, strategy,
  ));
  return p;
}

function mkTeam(key: string, name: string): Team {
  return {
    teamKey: key, teamId: key, name, isOwnedByCurrentLogin: false,
    numberOfMoves: 0, numberOfTrades: 0, managerNicknames: [],
  };
}

const roster = (teamKey: string, players: Player[]): Roster => ({
  teamKey, week: 5, isEditable: true, players,
});

test('flex slots are shared across eligible positions, not double counted', () => {
  const required = requiredStarters(settings);
  assert.equal(required.get('QB'), 1);
  // 2 dedicated RB + one third of the single flex.
  assert.ok(required.get('RB')! > 2 && required.get('RB')! < 3);
  assert.ok(required.get('TE')! > 1 && required.get('TE')! < 2);
});

test('profiling identifies surplus and the weakest forced starter', () => {
  const players = [
    value(mk('Qb', 'QB'), 18),
    value(mk('Rb A', 'RB'), 16), value(mk('Rb B', 'RB'), 14),
    value(mk('Rb C', 'RB'), 13), value(mk('Rb D', 'RB'), 12),
    value(mk('Wr A', 'WR'), 11), value(mk('Wr B', 'WR'), 4),
    value(mk('Te', 'TE'), 9),
  ];
  const profile = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', players), allValuations, settings);

  const rb = profile.strengths.get('RB')!;
  assert.ok(rb.surplus > 0, 'four backs for two-and-a-bit slots is a surplus');
  assert.ok(rb.depth.length > 0);

  const wr = profile.strengths.get('WR')!;
  assert.ok(wr.weakestStarter <= 4.1, 'the 4-point receiver is forced into a starting slot');
});

test('marginal value counts only the improvement to the starting lineup', () => {
  const players = [
    value(mk('Rb 1', 'RB'), 16), value(mk('Rb 2', 'RB'), 14), value(mk('Rb 3', 'RB'), 13),
  ];
  const profile = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', players), allValuations, settings);

  // Adding a 15-point back to a team whose weakest starter is 14 gains ~1.
  const gain = marginalValue(profile, 'RB', 15);
  assert.ok(gain > 0 && gain < 3, `expected a small marginal gain, got ${gain}`);

  // Adding someone worse than the current starters gains nothing.
  assert.equal(marginalValue(profile, 'RB', 5), 0);
});

test('a surplus-for-need swap is found and helps both sides', () => {
  allValuations.clear();
  // I am deep at RB and starting a terrible WR2.
  const mine = [
    value(mk('My Qb', 'QB'), 18),
    value(mk('My Rb1', 'RB'), 17), value(mk('My Rb2', 'RB'), 15),
    value(mk('My Rb3', 'RB'), 14), value(mk('My Rb4', 'RB'), 13),
    value(mk('My Wr1', 'WR'), 12), value(mk('My Wr2', 'WR'), 3),
    value(mk('My Te', 'TE'), 9),
  ];
  // They are deep at WR and starting a terrible RB2.
  const theirs = [
    value(mk('Their Qb', 'QB'), 17),
    value(mk('Their Rb1', 'RB'), 12), value(mk('Their Rb2', 'RB'), 3),
    value(mk('Their Wr1', 'WR'), 16), value(mk('Their Wr2', 'WR'), 15),
    value(mk('Their Wr3', 'WR'), 14), value(mk('Their Wr4', 'WR'), 13),
    value(mk('Their Te', 'TE'), 9),
  ];

  const me = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', mine), allValuations, settings);
  const rival = profileTeam(mkTeam('t.2', 'Rival'), roster('t.2', theirs), allValuations, settings);

  const ideas = generateTradeIdeas({ me, rivals: [rival], valuations: allValuations, strategy });

  assert.ok(ideas.length > 0, 'a complementary trade should be found');
  const idea = ideas[0]!;
  assert.equal(idea.send[0]!.position, 'RB', 'I send from my surplus');
  assert.equal(idea.receive[0]!.position, 'WR', 'I receive at my position of need');
  assert.ok(idea.myGain > 0);
  assert.ok(idea.theirGain > 0, 'the other manager must gain too or they will never accept');
});

test('trades that only help me are never proposed', () => {
  allValuations.clear();
  const mine = [
    value(mk('My Qb', 'QB'), 18),
    value(mk('My Rb1', 'RB'), 5), value(mk('My Rb2', 'RB'), 4),
    value(mk('My Wr1', 'WR'), 5), value(mk('My Wr2', 'WR'), 4),
    value(mk('My Te', 'TE'), 4),
  ];
  // A stacked rival with nothing to gain from any of my players.
  const theirs = [
    value(mk('Their Qb', 'QB'), 22),
    value(mk('Their Rb1', 'RB'), 20), value(mk('Their Rb2', 'RB'), 19),
    value(mk('Their Wr1', 'WR'), 20), value(mk('Their Wr2', 'WR'), 19),
    value(mk('Their Te', 'TE'), 15),
  ];

  const me = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', mine), allValuations, settings);
  const rival = profileTeam(mkTeam('t.2', 'Rival'), roster('t.2', theirs), allValuations, settings);

  const ideas = generateTradeIdeas({ me, rivals: [rival], valuations: allValuations, strategy });
  assert.equal(ideas.length, 0, 'a fleecing offer is worse than no offer');
});

test('untouchable players are never offered', () => {
  allValuations.clear();
  const star = value(mk('Untouchable Rb', 'RB'), 20);
  const mine = [
    value(mk('My Qb', 'QB'), 18), star,
    value(mk('My Rb2', 'RB'), 15), value(mk('My Rb3', 'RB'), 14),
    value(mk('My Wr1', 'WR'), 10), value(mk('My Wr2', 'WR'), 2),
    value(mk('My Te', 'TE'), 9),
  ];
  const theirs = [
    value(mk('Their Qb', 'QB'), 17),
    value(mk('Their Rb1', 'RB'), 11), value(mk('Their Rb2', 'RB'), 2),
    value(mk('Their Wr1', 'WR'), 16), value(mk('Their Wr2', 'WR'), 15),
    value(mk('Their Wr3', 'WR'), 14), value(mk('Their Te', 'TE'), 9),
  ];

  const me = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', mine), allValuations, settings);
  const rival = profileTeam(mkTeam('t.2', 'Rival'), roster('t.2', theirs), allValuations, settings);

  const ideas = generateTradeIdeas({
    me, rivals: [rival], valuations: allValuations, strategy,
    untouchable: (p) => p.playerKey === star.playerKey,
  });

  assert.ok(!ideas.some((i) => i.send.some((s) => s.playerKey === star.playerKey)),
    'the protected player never appears in an offer');
});

test('same-position swaps are skipped as pointless', () => {
  allValuations.clear();
  const mine = [value(mk('My Rb1', 'RB'), 16), value(mk('My Rb2', 'RB'), 15)];
  const theirs = [value(mk('Their Rb1', 'RB'), 16), value(mk('Their Rb2', 'RB'), 15)];
  const me = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', mine), allValuations, settings);
  const rival = profileTeam(mkTeam('t.2', 'Rival'), roster('t.2', theirs), allValuations, settings);

  const ideas = generateTradeIdeas({ me, rivals: [rival], valuations: allValuations, strategy });
  assert.equal(ideas.length, 0);
});

test('at most one idea per rival, so the alert stays readable', () => {
  allValuations.clear();
  const mine = [
    value(mk('My Qb', 'QB'), 18),
    value(mk('My Rb1', 'RB'), 17), value(mk('My Rb2', 'RB'), 16),
    value(mk('My Rb3', 'RB'), 15), value(mk('My Rb4', 'RB'), 14),
    value(mk('My Wr1', 'WR'), 9), value(mk('My Wr2', 'WR'), 2),
    value(mk('My Te', 'TE'), 8),
  ];
  const theirs = [
    value(mk('Their Qb', 'QB'), 17),
    value(mk('Their Rb1', 'RB'), 10), value(mk('Their Rb2', 'RB'), 2),
    value(mk('Their Wr1', 'WR'), 16), value(mk('Their Wr2', 'WR'), 15),
    value(mk('Their Wr3', 'WR'), 14), value(mk('Their Wr4', 'WR'), 13),
    value(mk('Their Te', 'TE'), 9),
  ];
  const me = profileTeam(mkTeam('t.1', 'Me'), roster('t.1', mine), allValuations, settings);
  const rival = profileTeam(mkTeam('t.2', 'Rival'), roster('t.2', theirs), allValuations, settings);

  const ideas = generateTradeIdeas({ me, rivals: [rival], valuations: allValuations, strategy, maxIdeas: 5 });
  assert.equal(ideas.length, 1, 'one rival yields one idea, not a flood of permutations');
});
