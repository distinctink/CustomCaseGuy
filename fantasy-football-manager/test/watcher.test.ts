import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeName, normalizeTeam, matchPlayer, levenshtein, initialKey } from '../src/util/names.js';
import { injuryEvents, newsEvents, isActionableHeadline } from '../src/watcher/events.js';
import { injuryCode } from '../src/espn/api.js';
import type { InjuryRecord, NewsItem } from '../src/espn/types.js';

// --- Name resolution --------------------------------------------------------

test('normalizeName strips punctuation, accents and generational suffixes', () => {
  assert.equal(normalizeName('A.J. Brown'), 'aj brown');
  assert.equal(normalizeName("Ja'Marr Chase"), 'jamarr chase');
  assert.equal(normalizeName('Patrick Mahomes II'), 'patrick mahomes');
  assert.equal(normalizeName('Odell Beckham Jr.'), 'odell beckham');
  assert.equal(normalizeName('Marvin Harrison Jr'), 'marvin harrison');
});

test('normalizeTeam reconciles ESPN and Yahoo abbreviations', () => {
  assert.equal(normalizeTeam('WSH'), 'WAS');
  assert.equal(normalizeTeam('JAC'), 'JAX');
  assert.equal(normalizeTeam('OAK'), 'LV');
  assert.equal(normalizeTeam('kc'), 'KC');
  assert.equal(normalizeTeam(undefined), '');
});

test('matchPlayer resolves the punctuation differences between sources', () => {
  const yahoo = [
    { name: 'AJ Brown', team: 'PHI', position: 'WR' },
    { name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR' },
  ];
  const hit = matchPlayer({ name: 'A.J. Brown', team: 'PHI', position: 'WR' }, yahoo);
  assert.equal(hit?.value.name, 'AJ Brown');
  assert.ok(hit!.confidence >= 0.9);
});

test('matchPlayer distinguishes same-named players on different teams', () => {
  const candidates = [
    { name: 'Michael Thomas', team: 'NO', position: 'WR' },
    { name: 'Michael Thomas', team: 'HOU', position: 'S' },
  ];
  const hit = matchPlayer({ name: 'Michael Thomas', team: 'NO', position: 'WR' }, candidates);
  assert.equal(hit?.value.team, 'NO');
});

test('matchPlayer refuses to guess when two candidates are equally plausible', () => {
  const candidates = [
    { name: 'Josh Allen', team: 'BUF', position: 'QB' },
    { name: 'Josh Allen', team: 'JAX', position: 'LB' },
  ];
  // No team given: both match the name exactly, so there is no safe answer.
  assert.equal(matchPlayer({ name: 'Josh Allen' }, candidates), undefined);
});

test('matchPlayer returns nothing rather than a low-confidence guess', () => {
  const candidates = [{ name: 'Christian McCaffrey', team: 'SF', position: 'RB' }];
  assert.equal(matchPlayer({ name: 'Totally Different Person', team: 'SF' }, candidates), undefined);
});

test('levenshtein and initialKey behave as the matcher expects', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('same', 'same'), 0);
  assert.equal(initialKey('D.J. Moore'), 'dmoore');
  assert.equal(initialKey('DJ Moore'), 'dmoore');
});

// --- Injury normalisation ---------------------------------------------------

test('ESPN injury prose maps onto short status codes', () => {
  assert.equal(injuryCode('Out'), 'O');
  assert.equal(injuryCode('Questionable'), 'Q');
  assert.equal(injuryCode('Doubtful'), 'D');
  assert.equal(injuryCode('Injured Reserve'), 'IR');
  assert.equal(injuryCode('Physically Unable to Perform'), 'PUP');
  assert.equal(injuryCode('Suspension'), 'SUSP');
  assert.equal(injuryCode('Active'), '');
  assert.equal(injuryCode(undefined), '');
});

// --- Event detection --------------------------------------------------------

function injury(over: Partial<InjuryRecord> = {}): InjuryRecord {
  return {
    id: 'i1', athleteId: '123', name: 'Starter Back', position: 'RB', team: 'CIN',
    status: 'Out', code: 'O', detail: 'ankle', ...over,
  };
}

test('the first injury poll seeds a baseline instead of firing on everyone', () => {
  const { events, snapshot } = injuryEvents([injury(), injury({ athleteId: '456', name: 'Other Guy' })], new Map());
  assert.equal(events.length, 0, 'no events on the very first pass');
  assert.equal(snapshot.size, 2, 'but the baseline is recorded');
});

test('a status worsening from questionable to out is material', () => {
  const before = new Map([['123', 'Q']]);
  const { events } = injuryEvents([injury({ code: 'O', status: 'Out' })], before);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.status, 'O');
  assert.equal(events[0]!.team, 'CIN');
});

test('an unchanged designation is not re-reported', () => {
  const before = new Map([['123', 'O']]);
  const { events } = injuryEvents([injury({ code: 'O' })], before);
  assert.equal(events.length, 0, 'a player who has been out for weeks is not news');
});

test('a player returning to active is material', () => {
  const before = new Map([['123', 'O']]);
  const { events } = injuryEvents([injury({ code: '', status: 'Active' })], before);
  assert.equal(events.length, 1);
  assert.match(events[0]!.headline, /back to active/);
});

test('a downgrade that does not sideline the player is ignored', () => {
  const before = new Map([['123', '']]);
  const { events } = injuryEvents([injury({ code: 'Q', status: 'Questionable' })], before);
  assert.equal(events.length, 0, 'questionable alone does not move the workload');
});

test('event hashes are stable, so the same change is not acted on twice', () => {
  const before = new Map([['123', 'Q']]);
  const a = injuryEvents([injury({ code: 'O' })], before).events[0]!;
  const b = injuryEvents([injury({ code: 'O' })], before).events[0]!;
  assert.equal(a.hash, b.hash);
});

// --- News classification ----------------------------------------------------

test('actionable headlines are recognised and fantasy fluff is not', () => {
  assert.ok(isActionableHeadline('Smith ruled out for Sunday'));
  assert.ok(isActionableHeadline('Jones placed on injured reserve'));
  assert.ok(isActionableHeadline('Brown named the starter at quarterback'));
  assert.ok(isActionableHeadline('Team waived veteran running back'));
  assert.equal(isActionableHeadline('Five fantasy sleepers for week 6'), false);
  assert.equal(isActionableHeadline('Power rankings: every team after week 5'), false);
});

function news(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'n1',
    headline: 'Starter Back ruled out for Sunday',
    description: '',
    published: new Date().toISOString(),
    publishedMs: Date.now(),
    type: 'Story',
    athletes: [{ id: '123', name: 'Starter Back', position: 'RB', team: 'CIN' }],
    teams: ['CIN'],
    ...over,
  };
}

test('news events are produced per tagged athlete', () => {
  const events = newsEvents([news()], 180);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.subject, 'Starter Back');
  assert.equal(events[0]!.status, 'O', 'ruled out implies the workload moves');
});

test('stale news is ignored so a restart does not replay last week', () => {
  const old = news({ publishedMs: Date.now() - 6 * 60 * 60 * 1000 });
  assert.equal(newsEvents([old], 180).length, 0);
  assert.equal(newsEvents([old], 24 * 60).length, 1, 'but a wider window still sees it');
});

test('news with no tagged athlete produces no event', () => {
  assert.equal(newsEvents([news({ athletes: [] })], 180).length, 0);
});

// --- Trade approval gate ----------------------------------------------------

test('trades cannot execute without a valid single-use token', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ffm-approvals-'));
  process.env.APPROVALS_PATH = join(dir, 'approvals.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Import after setting the path so the module picks it up.
  const { requestApproval, approve, consumeApproval, listApprovals } =
    await import(`../src/store/approvals.js?t=${Date.now()}`) as typeof import('../src/store/approvals.js');

  const req = requestApproval('trade', 'send A receive B', { a: 1 });
  assert.equal(req.status, 'pending');

  assert.equal(consumeApproval('not-a-real-token', 'trade'), undefined,
    'a made-up token is rejected');
  assert.equal(consumeApproval('', 'trade'), undefined, 'an empty token is rejected');

  const approved = approve(req.id);
  assert.ok(approved.token, 'approving mints a token');

  const first = consumeApproval(approved.token!, 'trade');
  assert.ok(first, 'the token works once');

  const second = consumeApproval(approved.token!, 'trade');
  assert.equal(second, undefined, 'the same token cannot authorise a second trade');

  assert.equal(listApprovals().find((r) => r.id === req.id)?.status, 'consumed');
});

test('duplicate approval requests are collapsed rather than stacked', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ffm-approvals-'));
  process.env.APPROVALS_PATH = join(dir, 'approvals.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const { requestApproval, listApprovals } =
    await import(`../src/store/approvals.js?t=${Date.now()}`) as typeof import('../src/store/approvals.js');

  const a = requestApproval('trade', 'same trade', { transactionKey: 'tr.1' });
  const b = requestApproval('trade', 'same trade', { transactionKey: 'tr.1' });
  assert.equal(a.id, b.id, 'the same pending proposal is not filed twice');
  assert.equal(listApprovals('pending').length, 1);
});
