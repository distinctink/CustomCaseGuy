/**
 * Safety properties of the write layer.
 *
 * These matter more than any other test in the project: they are what stands
 * between "autonomous" and "autonomously wrong". Both assertions hold before
 * any network call is attempted, so they run without Yahoo credentials.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { xmlEscape, describeError } from '../src/yahoo/client.js';

const LEAGUE = '461.l.123456';
const TEAM = '461.l.123456.t.4';

/** Fresh module graph with DRY_RUN on and an isolated approvals file. */
async function isolated() {
  const dir = mkdtempSync(join(tmpdir(), 'ffm-write-'));
  process.env.DRY_RUN = '1';
  process.env.APPROVALS_PATH = join(dir, 'approvals.json');
  const stamp = Date.now() + Math.random();
  const write = await import(`../src/yahoo/write.js?t=${stamp}`) as typeof import('../src/yahoo/write.js');
  const approvals = await import(`../src/store/approvals.js?t=${stamp}`) as typeof import('../src/store/approvals.js');
  return { write, approvals, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('proposeTrade refuses to send anything without an approval token', async (t) => {
  const { write, cleanup } = await isolated();
  t.after(cleanup);

  await assert.rejects(
    () => write.proposeTrade({
      leagueKey: LEAGUE, myTeamKey: TEAM, theirTeamKey: '461.l.123456.t.7',
      sendPlayerKeys: ['461.p.1'], receivePlayerKeys: ['461.p.2'],
      approvalToken: '',
    }),
    write.TradeApprovalRequired,
    'an empty token is refused',
  );

  await assert.rejects(
    () => write.proposeTrade({
      leagueKey: LEAGUE, myTeamKey: TEAM, theirTeamKey: '461.l.123456.t.7',
      sendPlayerKeys: ['461.p.1'], receivePlayerKeys: ['461.p.2'],
      approvalToken: 'a-token-i-just-made-up',
    }),
    write.TradeApprovalRequired,
    'a forged token is refused',
  );
});

test('respondToTrade is gated the same way', async (t) => {
  const { write, cleanup } = await isolated();
  t.after(cleanup);

  await assert.rejects(
    () => write.respondToTrade({ transactionKey: '461.l.1.tr.9', action: 'accept', approvalToken: 'nope' }),
    write.TradeApprovalRequired,
  );
});

test('an approved token lets exactly one trade through, then stops working', async (t) => {
  const { write, approvals, cleanup } = await isolated();
  t.after(cleanup);

  const req = approvals.requestApproval('trade', 'test trade', { x: 1 });
  const token = approvals.approve(req.id).token!;

  // DRY_RUN is on, so this exercises the gate without contacting Yahoo.
  const first = await write.proposeTrade({
    leagueKey: LEAGUE, myTeamKey: TEAM, theirTeamKey: '461.l.123456.t.7',
    sendPlayerKeys: ['461.p.1'], receivePlayerKeys: ['461.p.2'],
    approvalToken: token,
  });
  assert.equal(first.ok, true);
  assert.equal(first.dryRun, true);

  await assert.rejects(
    () => write.proposeTrade({
      leagueKey: LEAGUE, myTeamKey: TEAM, theirTeamKey: '461.l.123456.t.7',
      sendPlayerKeys: ['461.p.1'], receivePlayerKeys: ['461.p.2'],
      approvalToken: token,
    }),
    write.TradeApprovalRequired,
    'the token is single-use',
  );
});

test('dry run reports success without contacting Yahoo', async (t) => {
  const { write, cleanup } = await isolated();
  t.after(cleanup);

  // No OAuth tokens exist in this environment, so any real network path would
  // throw "Not authorised with Yahoo yet".
  const add = await write.addDrop({
    leagueKey: LEAGUE, teamKey: TEAM, addPlayerKey: '461.p.100', dropPlayerKey: '461.p.200',
  });
  assert.equal(add.dryRun, true);
  assert.match(add.detail, /DRY RUN/);

  const claim = await write.placeWaiverClaim({
    leagueKey: LEAGUE, teamKey: TEAM, addPlayerKey: '461.p.100',
  });
  assert.equal(claim.dryRun, true);

  const lineup = await write.setLineup({
    teamKey: TEAM, week: 5, slots: [{ playerKey: '461.p.100', position: 'WR' }],
  });
  assert.equal(lineup.dryRun, true);
});

// --- XML construction -------------------------------------------------------

test('xmlEscape neutralises characters that would break the payload', () => {
  assert.equal(xmlEscape(`Ja'Marr & "Co" <b>`), 'Ja&apos;Marr &amp; &quot;Co&quot; &lt;b&gt;');
  assert.equal(xmlEscape('461.p.1234'), '461.p.1234', 'ordinary keys pass through untouched');
});

test('Yahoo XML error bodies are surfaced as readable messages', () => {
  const body = '<?xml version="1.0"?><error xml:lang="en-us"><description>Player is not available.</description></error>';
  assert.equal(describeError(body), 'Player is not available.');
  assert.match(describeError('not xml at all'), /not xml at all/);
  assert.match(describeError(''), /empty body/);
});
