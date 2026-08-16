import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_STRATEGY, type StrategyConfig } from '../src/config.js';
import {
  evaluateClaim, priorityOptionValue, priorityCostOfWinning, rivalClaimProbability,
  activeRivalTeams, rankClaims, type WaiverContext,
} from '../src/engine/waiver.js';
import type { Player, Team, Transaction } from '../src/yahoo/types.js';

const strategy: StrategyConfig = structuredClone(DEFAULT_STRATEGY);

function player(over: Partial<Player> = {}): Player {
  return {
    playerKey: '461.p.1',
    playerId: '1',
    name: 'Waiver Target',
    firstName: 'Waiver',
    lastName: 'Target',
    team: 'CIN',
    displayPosition: 'RB',
    primaryPosition: 'RB',
    positionType: 'O',
    eligiblePositions: ['RB', 'W/R/T'],
    status: '',
    onDisabledList: false,
    isUndroppable: false,
    ranks: [],
    ownership: 'waivers',
    ...over,
  };
}

function ctx(over: Partial<WaiverContext> = {}): WaiverContext {
  return {
    myPriority: 3,
    numTeams: 12,
    activeRivalPriorities: [1, 5, 8],
    weeksRemaining: 10,
    ...over,
  };
}

// --- Priority option value --------------------------------------------------

test('priority #1 is worth more than any lower slot', () => {
  const first = priorityOptionValue(1, 10, strategy);
  const fifth = priorityOptionValue(5, 10, strategy);
  const last = priorityOptionValue(12, 10, strategy);
  assert.ok(first > fifth, 'first beats fifth');
  assert.ok(fifth > last, 'fifth beats last');
});

test('priority decays toward worthless as the season runs out', () => {
  const week1 = priorityOptionValue(1, 14, strategy);
  const late = priorityOptionValue(1, 2, strategy);
  assert.ok(week1 > late * 3, 'holding #1 in week 1 is far more valuable than in week 13');
  assert.equal(priorityOptionValue(1, 0, strategy), 0, 'no weeks left means no option value');
});

test('the cost of winning is the drop from your slot to the back of the queue', () => {
  const costAtOne = priorityCostOfWinning(ctx({ myPriority: 1 }), strategy);
  const costAtTen = priorityCostOfWinning(ctx({ myPriority: 10 }), strategy);
  assert.ok(costAtOne > costAtTen, 'burning #1 costs more than burning #10');
  assert.ok(costAtOne > 0);
  assert.equal(priorityCostOfWinning(ctx({ myPriority: 12, numTeams: 12 }), strategy), 0,
    'already last: nothing left to lose');
});

// --- Rival behaviour --------------------------------------------------------

test('rival claim probability rises with value and with ownership momentum', () => {
  const low = rivalClaimProbability(1.0, 0, strategy);
  const mid = rivalClaimProbability(4.0, 0, strategy);
  const hyped = rivalClaimProbability(4.0, 25, strategy);
  assert.ok(mid > low, 'a better player is more likely to be claimed');
  assert.ok(hyped > mid, 'a spiking rostered-% makes a rival claim more likely');
});

test('rival claim probability saturates for obvious must-adds and stays bounded', () => {
  assert.equal(rivalClaimProbability(25, 50, strategy), 0.95,
    'a league-winning pickup is treated as near-certain to be contested');
  assert.ok(rivalClaimProbability(0, 0, strategy) >= 0.02,
    'never assume a rival is completely asleep');
});

test('rivalPassivity tunes how often we expect to be contested', () => {
  const passive = { ...strategy, waiver: { ...strategy.waiver, rivalPassivity: 3 } };
  const aggressive = { ...strategy, waiver: { ...strategy.waiver, rivalPassivity: 0 } };
  assert.ok(
    rivalClaimProbability(3, 5, aggressive) > rivalClaimProbability(3, 5, passive),
    'lower passivity means rivals are modelled as more likely to claim',
  );
});

test('active rivals are detected from recent transactions, not assumed', () => {
  const teams: Team[] = [
    mkTeam('t.1', 'Me', 0),
    mkTeam('t.2', 'Busy Rival', 9),
    mkTeam('t.3', 'Ghost', 0),
    mkTeam('t.4', 'Occasional', 2),
  ];
  const recent: Transaction[] = [
    {
      transactionKey: 'tr.1', transactionId: '1', type: 'add/drop', status: 'successful',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
      players: [{ playerKey: 'p.9', name: 'X', position: 'RB', type: 'add', destinationTeamKey: '461.l.1.t.2' }],
    },
  ];

  const active = activeRivalTeams(teams, recent, '461.l.1.t.1', strategy);
  assert.deepEqual(active.map((t) => t.name), ['Busy Rival'],
    'only the manager who actually moved counts as active');
});

test('with no transaction history we fall back to the configured rival count', () => {
  const teams: Team[] = [
    mkTeam('t.1', 'Me', 0), mkTeam('t.2', 'A', 5), mkTeam('t.3', 'B', 4),
    mkTeam('t.4', 'C', 3), mkTeam('t.5', 'D', 0),
  ];
  const active = activeRivalTeams(teams, [], '461.l.1.t.1', strategy);
  assert.equal(active.length, strategy.waiver.activeRivals);
  assert.deepEqual(active.map((t) => t.name), ['A', 'B', 'C'], 'ranked by moves made');
});

// --- The core decision ------------------------------------------------------

test('a marginal upgrade is skipped rather than spending anything', () => {
  const e = evaluateClaim({ player: player(), valueAdded: 0.4, context: ctx(), strategy });
  assert.equal(e.recommendation, 'skip');
  assert.match(e.reasons.join(' '), /below the .* threshold/);
});

test('a free agent is added immediately — no priority is at stake', () => {
  const e = evaluateClaim({
    player: player({ ownership: 'freeagents' }),
    valueAdded: 4,
    context: ctx(),
    strategy,
  });
  assert.equal(e.recommendation, 'add_now');
  assert.match(e.reasons.join(' '), /first come/i);
});

test('an uncontested waiver player is left to clear rather than claimed', () => {
  // Low value-add above threshold, no ownership momentum, few rivals: nobody
  // else is going to burn priority here, so neither should we.
  const e = evaluateClaim({
    player: player({ percentOwnedDelta: 0 }),
    valueAdded: 2.0,
    context: ctx({ activeRivalPriorities: [8], myPriority: 3 }),
    strategy,
  });
  assert.equal(e.recommendation, 'wait_for_free_agency');
  assert.ok(e.probabilityContested < strategy.waiver.contestThreshold);
});

test('a genuinely contested difference-maker is claimed', () => {
  const e = evaluateClaim({
    player: player({ percentOwnedDelta: 30 }),
    valueAdded: 9,
    context: ctx({ myPriority: 2, activeRivalPriorities: [1, 4, 6], weeksRemaining: 11 }),
    strategy,
  });
  assert.equal(e.recommendation, 'claim');
  assert.ok(e.evClaim > e.evWait);
});

test('holding priority #1 makes us pickier than holding priority #11', () => {
  const contested = { percentOwnedDelta: 18 };
  const shared = { player: player(contested), valueAdded: 3.2, strategy };

  const atFirst = evaluateClaim({ ...shared, context: ctx({ myPriority: 1, activeRivalPriorities: [3, 6, 9] }) });
  const atLast = evaluateClaim({ ...shared, context: ctx({ myPriority: 11, activeRivalPriorities: [3, 6, 9] }) });

  assert.ok(atFirst.priorityCost > atLast.priorityCost,
    'the option value we would give up is larger at #1');
});

test('late in the season priority is nearly free, so we spend it more readily', () => {
  const shared = { player: player({ percentOwnedDelta: 15 }), valueAdded: 4, strategy };
  const early = evaluateClaim({ ...shared, context: ctx({ myPriority: 1, weeksRemaining: 13 }) });
  const late = evaluateClaim({ ...shared, context: ctx({ myPriority: 1, weeksRemaining: 2 }) });
  assert.ok(late.priorityCost < early.priorityCost);
});

test('winning is less likely when rivals hold better priority', () => {
  const shared = { player: player({ percentOwnedDelta: 20 }), valueAdded: 6, strategy };
  const ahead = evaluateClaim({ ...shared, context: ctx({ myPriority: 1, activeRivalPriorities: [4, 7, 9] }) });
  const behind = evaluateClaim({ ...shared, context: ctx({ myPriority: 10, activeRivalPriorities: [1, 2, 3] }) });
  assert.ok(ahead.probabilityWinClaim > behind.probabilityWinClaim);
  assert.equal(ahead.probabilityWinClaim, 1, 'nobody ahead of us means we cannot be outbid');
});

test('rankClaims orders by expected value and drops non-claims', () => {
  const base = { player: player({ percentOwnedDelta: 25 }), context: ctx({ myPriority: 1 }), strategy };
  const big = evaluateClaim({ ...base, player: player({ playerKey: 'p.big', percentOwnedDelta: 25 }), valueAdded: 9 });
  const small = evaluateClaim({ ...base, player: player({ playerKey: 'p.small', percentOwnedDelta: 25 }), valueAdded: 4 });
  const skipped = evaluateClaim({ ...base, player: player({ playerKey: 'p.no' }), valueAdded: 0.1 });

  const ranked = rankClaims([small, big, skipped]);
  assert.ok(ranked.length >= 1);
  assert.equal(ranked[0]!.playerKey, 'p.big', 'highest EV first');
  assert.ok(!ranked.some((r) => r.playerKey === 'p.no'), 'skips are excluded');
});

test('expected games of use scales the value of a pickup', () => {
  const shared = { player: player({ percentOwnedDelta: 20 }), valueAdded: 5, context: ctx(), strategy };
  const fullSeason = evaluateClaim({ ...shared, expectedGamesOfUse: 10 });
  const oneWeek = evaluateClaim({ ...shared, expectedGamesOfUse: 1 });
  assert.ok(fullSeason.seasonValue > oneWeek.seasonValue);
  assert.equal(oneWeek.seasonValue, 5);
});

function mkTeam(id: string, name: string, moves: number): Team {
  return {
    teamKey: `461.l.1.${id}`,
    teamId: id,
    name,
    isOwnedByCurrentLogin: false,
    numberOfMoves: moves,
    numberOfTrades: 0,
    managerNicknames: [],
  };
}
