import test from 'node:test';
import assert from 'node:assert/strict';

import {
  curveValue, adaptToScoring, overallRank, positionalRanks, baselinePPG,
  productionConfidence, blendWithProduction,
} from '../src/engine/baseline.js';
import { DEFAULT_STRATEGY, type StrategyConfig } from '../src/config.js';
import type { LeagueSettings, Player } from '../src/yahoo/types.js';

const strategy: StrategyConfig = structuredClone(DEFAULT_STRATEGY);

function leagueWith(modifiers: [number, number][]): LeagueSettings {
  return {
    league: {
      leagueKey: '461.l.1', leagueId: '1', name: 'Test', numTeams: 12, currentWeek: 1,
      startWeek: 1, endWeek: 17, season: '2026', waiverType: 'R', waiverRule: 'gametime',
      usesFaab: false, scoringType: 'head', isFinished: false,
    },
    rosterSlots: [], statCategories: [], statModifiers: new Map(modifiers),
    startingSlots: [], benchCount: 6, irCount: 1,
  };
}

const ppr = leagueWith([[11, 1], [12, 0.1], [13, 6], [5, 4]]);
const standard = leagueWith([[12, 0.1], [13, 6], [5, 4]]);
const sixPointTd = leagueWith([[11, 1], [12, 0.1], [13, 6], [5, 6]]);

let seq = 0;
function mk(name: string, pos: string, over: Partial<Player> = {}): Player {
  return {
    playerKey: `461.p.${++seq}`, playerId: String(seq), name, firstName: name, lastName: '',
    team: 'KC', displayPosition: pos, primaryPosition: pos, positionType: 'O',
    eligiblePositions: [pos], status: '', onDisabledList: false, isUndroppable: false,
    ranks: [], ...over,
  };
}

// --- Curves -----------------------------------------------------------------

test('the curve decreases monotonically with positional rank', () => {
  let previous = Infinity;
  for (const rank of [1, 3, 6, 12, 24, 36, 48]) {
    const v = curveValue('RB', rank);
    assert.ok(v <= previous, `RB${rank} (${v}) should not exceed RB${rank - 1} (${previous})`);
    previous = v;
  }
});

test('the curve interpolates between anchors and holds flat past the end', () => {
  const rb1 = curveValue('RB', 1);
  const rb4 = curveValue('RB', 4);
  const between = curveValue('RB', 2);
  assert.ok(between < rb1 && between > rb4, 'rank 2 falls between its neighbours');

  assert.equal(curveValue('RB', 500), curveValue('RB', 60), 'deep ranks hold at the floor');
  assert.equal(curveValue('RB', 0), rb1, 'ranks below 1 clamp');
});

test('an unknown position yields no baseline rather than a wrong one', () => {
  assert.equal(curveValue('LB', 1), 0);
});

test('scoring adaptation moves receivers between PPR and standard', () => {
  const raw = curveValue('WR', 12);
  const inPpr = adaptToScoring('WR', raw, ppr);
  const inStandard = adaptToScoring('WR', raw, standard);
  assert.equal(inPpr, raw, 'the curves are anchored to full PPR');
  assert.ok(inStandard < inPpr - 4, 'a WR loses roughly a reception-per-game worth of points');
});

test('scoring adaptation raises quarterbacks in 6-point-TD leagues', () => {
  const raw = curveValue('QB', 6);
  assert.ok(adaptToScoring('QB', raw, sixPointTd) > adaptToScoring('QB', raw, ppr) + 2);
});

test('kickers are unaffected by reception scoring', () => {
  const raw = curveValue('K', 6);
  assert.equal(adaptToScoring('K', raw, ppr), adaptToScoring('K', raw, standard));
});

// --- Ranks ------------------------------------------------------------------

test('overallRank prefers in-season rank over preseason', () => {
  const p = mk('Ranked Guy', 'WR', {
    ranks: [
      { rankType: 'PR', rankValue: 40, rankSeason: '2026' },
      { rankType: 'AR', rankValue: 12, rankSeason: '2026' },
    ],
  });
  assert.equal(overallRank(p), 12);
});

test('overallRank falls back to whatever rank exists', () => {
  assert.equal(overallRank(mk('A', 'WR', { ranks: [{ rankType: 'ZZ', rankValue: 7 }] })), 7);
  assert.equal(overallRank(mk('B', 'WR')), undefined);
});

test('positional ranks are derived across the whole universe, not the wire alone', () => {
  const universe = [
    mk('Elite Wr', 'WR', { ranks: [{ rankType: 'AR', rankValue: 3 }] }),
    mk('Good Wr', 'WR', { ranks: [{ rankType: 'AR', rankValue: 25 }] }),
    mk('Wire Wr', 'WR', { ranks: [{ rankType: 'AR', rankValue: 140 }] }),
    mk('Elite Rb', 'RB', { ranks: [{ rankType: 'AR', rankValue: 1 }] }),
  ];
  const ranks = positionalRanks(universe);

  assert.equal(ranks.get(universe[0]!.playerKey), 1, 'WR ranks are independent of RB ranks');
  assert.equal(ranks.get(universe[1]!.playerKey), 2);
  assert.equal(ranks.get(universe[2]!.playerKey), 3);
  assert.equal(ranks.get(universe[3]!.playerKey), 1, 'the top RB is RB1 even though a WR outranks him overall');
});

test('unranked players sort behind ranked ones, broken by ownership', () => {
  const universe = [
    mk('Ranked', 'TE', { ranks: [{ rankType: 'AR', rankValue: 50 }] }),
    mk('Unranked Popular', 'TE', { percentOwned: 30 }),
    mk('Unranked Ignored', 'TE', { percentOwned: 1 }),
  ];
  const ranks = positionalRanks(universe);
  assert.equal(ranks.get(universe[0]!.playerKey), 1);
  assert.equal(ranks.get(universe[1]!.playerKey), 2, 'the more widely rostered unranked player ranks higher');
  assert.equal(ranks.get(universe[2]!.playerKey), 3);
});

// --- Baseline ---------------------------------------------------------------

test('baseline gives a real number in preseason, when production is all zero', () => {
  const player = mk('Preseason Rb', 'RB', { ranks: [{ rankType: 'PR', rankValue: 20 }] });
  const value = baselinePPG({ player, positionalRank: 8, settings: ppr, strategy });
  assert.ok(value > 5, `expected a usable preseason estimate, got ${value}`);
});

test('a better positional rank is worth more', () => {
  const player = mk('Rb', 'RB');
  const rb3 = baselinePPG({ player, positionalRank: 3, settings: ppr, strategy });
  const rb30 = baselinePPG({ player, positionalRank: 30, settings: ppr, strategy });
  assert.ok(rb3 > rb30 + 3);
});

test('an unranked player is treated as replacement level, not guessed at', () => {
  const player = mk('Nobody', 'WR', { percentOwned: 0 });
  const value = baselinePPG({ player, positionalRank: undefined, settings: ppr, strategy });
  const floor = adaptToScoring('WR', curveValue('WR', 999), ppr);
  assert.ok(Math.abs(value - floor) < 1.5, `expected roughly the curve floor, got ${value}`);
});

test('ownership nudges the baseline without driving it', () => {
  const base = mk('Mid Wr', 'WR', { percentOwned: 5 });
  const hyped = mk('Hyped Wr', 'WR', { percentOwned: 95 });
  const low = baselinePPG({ player: base, positionalRank: 30, settings: ppr, strategy });
  const high = baselinePPG({ player: hyped, positionalRank: 30, settings: ppr, strategy });

  assert.ok(high > low, 'a widely rostered player at the same rank is worth more');
  assert.ok(high - low < 4, 'but ownership does not dominate the rank signal');
});

test('ownershipWeight of zero makes the baseline rank-only', () => {
  const noOwnership = { ...strategy, valuation: { ...strategy.valuation, ownershipWeight: 0 } };
  const a = baselinePPG({ player: mk('A', 'WR', { percentOwned: 2 }), positionalRank: 20, settings: ppr, strategy: noOwnership });
  const b = baselinePPG({ player: mk('B', 'WR', { percentOwned: 98 }), positionalRank: 20, settings: ppr, strategy: noOwnership });
  assert.equal(a, b);
});

// --- Blending ---------------------------------------------------------------

test('production confidence ramps from nothing to full', () => {
  assert.equal(productionConfidence(0, 4), 0, 'preseason trusts production not at all');
  assert.equal(productionConfidence(2, 4), 0.5);
  assert.equal(productionConfidence(4, 4), 1);
  assert.equal(productionConfidence(9, 4), 1, 'confidence is capped');
});

test('the blend is the prior in week one and production by week five', () => {
  const production = 20;
  const prior = 10;
  assert.equal(blendWithProduction(production, prior, 0, 4), 10, 'no games: prior only');
  assert.equal(blendWithProduction(production, prior, 2, 4), 15, 'halfway: even split');
  assert.equal(blendWithProduction(production, prior, 4, 4), 20, 'enough games: production only');
});

test('a zero ramp means production is trusted immediately', () => {
  assert.equal(blendWithProduction(20, 10, 0, 0), 20);
});
