import test from 'node:test';
import assert from 'node:assert/strict';

import { fantasyContent, mergeAll, listOf, pluck, asObject, num, bool, findFragment } from '../src/yahoo/parse.js';
import { mapPlayer, mapLeague } from '../src/yahoo/read.js';
import { rosterResponse, settingsResponse, freeAgentsResponse, transactionsResponse } from './fixtures.js';

test('mergeAll flattens Yahoo array-of-fragments, including nested arrays', () => {
  const merged = mergeAll([[{ a: 1 }, { b: 2 }], { c: 3 }]);
  assert.deepEqual(merged, { a: 1, b: 2, c: 3 });
});

test('mergeAll leaves list-shaped values untouched', () => {
  const merged = mergeAll([{ eligible_positions: [{ position: 'WR' }, { position: 'W/R/T' }] }]);
  assert.ok(Array.isArray(merged.eligible_positions));
  assert.equal((merged.eligible_positions as unknown[]).length, 2);
});

test('listOf turns numeric-keyed collections into arrays and respects count', () => {
  const coll = { '0': { player: [{ x: 1 }] }, '1': { player: [{ x: 2 }] }, count: 2 };
  assert.deepEqual(listOf(coll, 'player'), [{ x: 1 }, { x: 2 }]);
});

test('listOf stops at the first gap when count is absent', () => {
  const coll = { '0': { player: [{ x: 1 }] }, '2': { player: [{ x: 3 }] } };
  assert.equal(listOf(coll, 'player').length, 1);
});

test('pluck extracts values from single-key wrapper lists', () => {
  assert.deepEqual(pluck([{ position: 'WR' }, { position: 'W/R/T' }], 'position'), ['WR', 'W/R/T']);
  assert.deepEqual(pluck({ position: 'QB' }, 'position'), ['QB']);
  assert.deepEqual(pluck(undefined, 'position'), []);
});

test('asObject handles Yahoo sending an entity as either object or one-element array', () => {
  assert.deepEqual(asObject([{ type: 'drop' }]), { type: 'drop' });
  assert.deepEqual(asObject({ type: 'drop' }), { type: 'drop' });
});

test('num and bool coerce Yahoo string-typed scalars', () => {
  assert.equal(num('12'), 12);
  assert.equal(num('', 5), 5);
  assert.equal(num(undefined, 3), 3);
  assert.equal(bool('1'), true);
  assert.equal(bool('0'), false);
  assert.equal(bool(1), true);
});

test('findFragment locates a sub-resource regardless of position', () => {
  const entity = [[{ a: 1 }], { settings: [{ x: 1 }] }];
  assert.ok(findFragment(entity, 'settings'));
  assert.equal(findFragment(entity, 'missing'), undefined);
});

test('fantasyContent rejects a response without the envelope', () => {
  assert.throws(() => fantasyContent({ nope: true }), /fantasy_content/);
});

// ---------------------------------------------------------------------------

test('mapPlayer reads a roster player including its lineup slot', () => {
  const fc = fantasyContent(rosterResponse);
  const roster = asObject(findFragment(fc.team, 'roster'));
  const playersNode = asObject(roster['0']).players;
  const players = listOf(playersNode, 'player').map(mapPlayer);

  assert.equal(players.length, 2);
  const mahomes = players[0]!;
  assert.equal(mahomes.name, 'Patrick Mahomes');
  assert.equal(mahomes.playerKey, '461.p.30977');
  assert.equal(mahomes.team, 'KC');
  assert.equal(mahomes.selectedPosition, 'QB');
  assert.equal(mahomes.byeWeek, 10);
  assert.equal(mahomes.isUndroppable, false);

  const bench = players[1]!;
  assert.equal(bench.selectedPosition, 'BN');
  assert.equal(bench.status, 'Q');
  assert.deepEqual(bench.eligiblePositions, ['RB', 'W/R/T']);
});

test('mapPlayer reads ownership, percent owned and ranks from the player pool', () => {
  const fc = fantasyContent(freeAgentsResponse);
  const players = listOf(findFragment(fc.league, 'players'), 'player').map(mapPlayer);
  const p = players[0]!;

  assert.equal(p.name, "Ja'Marr Waiver");
  assert.equal(p.team, 'CIN', 'team abbreviation is upper-cased');
  assert.equal(p.ownership, 'waivers');
  assert.equal(p.waiverDate, '2025-10-08');
  assert.equal(p.percentOwned, 34);
  assert.equal(p.percentOwnedDelta, 12);
  assert.equal(p.ranks.length, 2);
  assert.equal(p.ranks.find((r) => r.rankType === 'AR')?.rankValue, 31);
});

test('mapLeague reads waiver configuration', () => {
  const fc = fantasyContent(settingsResponse);
  const league = mapLeague(fc.league);
  assert.equal(league.leagueKey, '461.l.123456');
  assert.equal(league.numTeams, 12);
  assert.equal(league.currentWeek, 5);
  assert.equal(league.usesFaab, false, 'this league is waiver priority, not FAAB');
  assert.equal(league.waiverType, 'R');
});

test('transaction players parse whether transaction_data is an array or an object', () => {
  const fc = fantasyContent(transactionsResponse);
  const txs = listOf(findFragment(fc.league, 'transactions'), 'transaction');
  const players = listOf(txs[0]!.players, 'player');

  const added = mergeAll(players[0]!.transaction_data);
  assert.equal(added.type, 'add');
  assert.equal(added.destination_team_key, '461.l.123456.t.7');

  const dropped = mergeAll(players[1]!.transaction_data);
  assert.equal(dropped.type, 'drop');
  assert.equal(dropped.source_team_key, '461.l.123456.t.7');
});
