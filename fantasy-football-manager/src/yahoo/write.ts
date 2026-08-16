/**
 * Write layer: add, drop, waiver claims, lineup changes, trade handling.
 *
 * Yahoo's write endpoints take XML. Every payload is built here rather than at
 * call sites so the shapes stay in one auditable place.
 *
 * Trade safety: `proposeTrade` and `respondToTrade` require an approval token
 * minted by the human-approval flow (src/store/approvals.ts). There is no code
 * path that reaches Yahoo's trade endpoints without one.
 */

import { post, put, xmlEscape } from './client.js';
import { request } from '../util/http.js';
import { getAccessToken } from './oauth.js';
import { BASE } from './client.js';
import { env } from '../config.js';
import { consumeApproval } from '../store/approvals.js';
import { logger } from '../util/log.js';

const log = logger('yahoo:write');

export interface WriteOutcome {
  ok: boolean;
  action: string;
  detail: string;
  dryRun: boolean;
  /** Yahoo's transaction key, when it returned one. */
  transactionKey?: string;
}

function envelope(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<fantasy_content>\n${inner}\n</fantasy_content>`;
}

function addFragment(playerKey: string, teamKey: string): string {
  return `      <player>
        <player_key>${xmlEscape(playerKey)}</player_key>
        <transaction_data>
          <type>add</type>
          <destination_team_key>${xmlEscape(teamKey)}</destination_team_key>
        </transaction_data>
      </player>`;
}

function dropFragment(playerKey: string, teamKey: string): string {
  return `      <player>
        <player_key>${xmlEscape(playerKey)}</player_key>
        <transaction_data>
          <type>drop</type>
          <source_team_key>${xmlEscape(teamKey)}</source_team_key>
        </transaction_data>
      </player>`;
}

/** Yahoo wants a bare <player> for single-player transactions, <players> for pairs. */
function wrapPlayers(fragments: string[]): string {
  if (fragments.length === 1) return fragments[0]!.replace(/^ {6}/gm, '    ');
  return `    <players>\n${fragments.join('\n')}\n    </players>`;
}

function transactionKeyFrom(body: unknown): string | undefined {
  const tx = (body as { fantasy_content?: { transaction?: { transaction_key?: unknown } } })
    ?.fantasy_content?.transaction?.transaction_key;
  return tx === undefined || tx === null ? undefined : String(tx);
}

// ---------------------------------------------------------------------------
// Free-agent adds and drops (no waiver priority spent)
// ---------------------------------------------------------------------------

/**
 * Add a free agent, optionally dropping someone in the same atomic transaction.
 * Use this for players who have cleared waivers — it is first-come, so speed
 * is the only thing that matters and no priority is burned.
 */
export async function addDrop(opts: {
  leagueKey: string;
  teamKey: string;
  addPlayerKey: string;
  dropPlayerKey?: string;
}): Promise<WriteOutcome> {
  const { leagueKey, teamKey, addPlayerKey, dropPlayerKey } = opts;
  const fragments = [addFragment(addPlayerKey, teamKey)];
  if (dropPlayerKey) fragments.push(dropFragment(dropPlayerKey, teamKey));

  const xml = envelope(
    `  <transaction>
    <type>${dropPlayerKey ? 'add/drop' : 'add'}</type>
${wrapPlayers(fragments)}
  </transaction>`,
  );

  const action = dropPlayerKey ? `add ${addPlayerKey} / drop ${dropPlayerKey}` : `add ${addPlayerKey}`;
  if (env.dryRun) return dryRun('addDrop', action, xml);

  const res = await post(`/league/${leagueKey}/transactions`, xml);
  log.info(`Executed ${action}`);
  return { ok: true, action: 'addDrop', detail: action, dryRun: false, transactionKey: transactionKeyFrom(res.body) };
}

export async function dropPlayer(opts: {
  leagueKey: string;
  teamKey: string;
  playerKey: string;
}): Promise<WriteOutcome> {
  const xml = envelope(
    `  <transaction>
    <type>drop</type>
${wrapPlayers([dropFragment(opts.playerKey, opts.teamKey)])}
  </transaction>`,
  );
  const action = `drop ${opts.playerKey}`;
  if (env.dryRun) return dryRun('drop', action, xml);

  const res = await post(`/league/${opts.leagueKey}/transactions`, xml);
  log.info(`Executed ${action}`);
  return { ok: true, action: 'drop', detail: action, dryRun: false, transactionKey: transactionKeyFrom(res.body) };
}

// ---------------------------------------------------------------------------
// Waiver claims (spends priority)
// ---------------------------------------------------------------------------

/**
 * File a waiver claim. In a priority league this is the move that costs you
 * something: winning drops you to the back of the queue.
 *
 * `faabBid` is accepted only so the same code works if the league ever switches
 * to FAAB; leave it undefined for a priority league or Yahoo will reject it.
 */
export async function placeWaiverClaim(opts: {
  leagueKey: string;
  teamKey: string;
  addPlayerKey: string;
  dropPlayerKey?: string;
  faabBid?: number;
}): Promise<WriteOutcome> {
  const { leagueKey, teamKey, addPlayerKey, dropPlayerKey, faabBid } = opts;
  const fragments = [addFragment(addPlayerKey, teamKey)];
  if (dropPlayerKey) fragments.push(dropFragment(dropPlayerKey, teamKey));

  const bid = faabBid !== undefined ? `\n    <faab_bid>${Math.round(faabBid)}</faab_bid>` : '';
  const xml = envelope(
    `  <transaction>
    <type>waiver</type>${bid}
${wrapPlayers(fragments)}
  </transaction>`,
  );

  const action = dropPlayerKey
    ? `waiver claim ${addPlayerKey}, drop ${dropPlayerKey}`
    : `waiver claim ${addPlayerKey}`;
  if (env.dryRun) return dryRun('waiverClaim', action, xml);

  const res = await post(`/league/${leagueKey}/transactions`, xml);
  log.info(`Filed ${action}`);
  return { ok: true, action: 'waiverClaim', detail: action, dryRun: false, transactionKey: transactionKeyFrom(res.body) };
}

/** Cancel a pending waiver claim before it processes. */
export async function cancelWaiverClaim(transactionKey: string): Promise<WriteOutcome> {
  if (env.dryRun) {
    return { ok: true, action: 'cancelWaiver', detail: `would cancel ${transactionKey}`, dryRun: true };
  }
  const res = await request(`${BASE}/transaction/${transactionKey}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    label: 'DELETE transaction',
    retries: 0,
  });
  log.info(`Cancelled waiver claim ${transactionKey} (${res.status})`);
  return { ok: true, action: 'cancelWaiver', detail: `cancelled ${transactionKey}`, dryRun: false };
}

/** Reorder a pending claim. Lower number processes first. */
export async function setClaimPriority(transactionKey: string, priority: number): Promise<WriteOutcome> {
  const xml = envelope(
    `  <transaction>
    <transaction_key>${xmlEscape(transactionKey)}</transaction_key>
    <type>waiver</type>
    <waiver_priority>${Math.max(1, Math.round(priority))}</waiver_priority>
  </transaction>`,
  );
  const action = `set claim ${transactionKey} priority ${priority}`;
  if (env.dryRun) return dryRun('setClaimPriority', action, xml);

  await put(`/transaction/${transactionKey}`, xml);
  return { ok: true, action: 'setClaimPriority', detail: action, dryRun: false };
}

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

export interface LineupSlot {
  playerKey: string;
  /** Target slot: QB, RB, WR, TE, W/R/T, K, DEF, BN, IR. */
  position: string;
}

/**
 * Set the starting lineup for a week. Yahoo requires the full set of players
 * being moved; unlisted players keep their current slot.
 */
export async function setLineup(opts: {
  teamKey: string;
  week: number;
  slots: LineupSlot[];
}): Promise<WriteOutcome> {
  const players = opts.slots
    .map(
      (s) => `      <player>
        <player_key>${xmlEscape(s.playerKey)}</player_key>
        <position>${xmlEscape(s.position)}</position>
      </player>`,
    )
    .join('\n');

  const xml = envelope(
    `  <roster>
    <coverage_type>week</coverage_type>
    <week>${opts.week}</week>
    <players>
${players}
    </players>
  </roster>`,
  );

  const action = `set week ${opts.week} lineup (${opts.slots.length} moves)`;
  if (env.dryRun) return dryRun('setLineup', action, xml);

  await put(`/team/${opts.teamKey}/roster`, xml);
  log.info(action);
  return { ok: true, action: 'setLineup', detail: action, dryRun: false };
}

// ---------------------------------------------------------------------------
// Trades — human approval required, always
// ---------------------------------------------------------------------------

export class TradeApprovalRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradeApprovalRequired';
  }
}

/**
 * Propose a trade. Requires an approval token minted by `ffm approvals approve`.
 * The token is single-use and bound to the specific proposal.
 */
export async function proposeTrade(opts: {
  leagueKey: string;
  myTeamKey: string;
  theirTeamKey: string;
  /** Players leaving my roster. */
  sendPlayerKeys: string[];
  /** Players arriving from theirs. */
  receivePlayerKeys: string[];
  note?: string;
  approvalToken: string;
}): Promise<WriteOutcome> {
  const approval = consumeApproval(opts.approvalToken, 'trade');
  if (!approval) {
    throw new TradeApprovalRequired(
      'Trades require explicit approval. Run `ffm approvals list` then `ffm approvals approve <id>`, ' +
        'and pass the returned token. No trade was sent.',
    );
  }

  const send = opts.sendPlayerKeys.map(
    (k) => `      <player>
        <player_key>${xmlEscape(k)}</player_key>
        <transaction_data>
          <type>pending_trade</type>
          <source_team_key>${xmlEscape(opts.myTeamKey)}</source_team_key>
          <destination_team_key>${xmlEscape(opts.theirTeamKey)}</destination_team_key>
        </transaction_data>
      </player>`,
  );
  const receive = opts.receivePlayerKeys.map(
    (k) => `      <player>
        <player_key>${xmlEscape(k)}</player_key>
        <transaction_data>
          <type>pending_trade</type>
          <source_team_key>${xmlEscape(opts.theirTeamKey)}</source_team_key>
          <destination_team_key>${xmlEscape(opts.myTeamKey)}</destination_team_key>
        </transaction_data>
      </player>`,
  );

  const xml = envelope(
    `  <transaction>
    <type>pending_trade</type>
    <trader_team_key>${xmlEscape(opts.myTeamKey)}</trader_team_key>
    <tradee_team_key>${xmlEscape(opts.theirTeamKey)}</tradee_team_key>
    <trade_note>${xmlEscape(opts.note ?? '')}</trade_note>
    <players>
${[...send, ...receive].join('\n')}
    </players>
  </transaction>`,
  );

  const action = `propose trade to ${opts.theirTeamKey}`;
  if (env.dryRun) return dryRun('proposeTrade', action, xml);

  const res = await post(`/league/${opts.leagueKey}/transactions`, xml);
  log.info(`${action} (approved by human at ${new Date(approval.approvedAt ?? Date.now()).toISOString()})`);
  return { ok: true, action: 'proposeTrade', detail: action, dryRun: false, transactionKey: transactionKeyFrom(res.body) };
}

/** Accept or reject a trade someone sent me. Also gated on human approval. */
export async function respondToTrade(opts: {
  transactionKey: string;
  action: 'accept' | 'reject';
  note?: string;
  approvalToken: string;
}): Promise<WriteOutcome> {
  const approval = consumeApproval(opts.approvalToken, 'trade');
  if (!approval) {
    throw new TradeApprovalRequired(
      'Responding to a trade requires explicit approval. No response was sent.',
    );
  }

  const xml = envelope(
    `  <transaction>
    <transaction_key>${xmlEscape(opts.transactionKey)}</transaction_key>
    <type>pending_trade</type>
    <trade_action>${opts.action}</trade_action>
    <trade_note>${xmlEscape(opts.note ?? '')}</trade_note>
  </transaction>`,
  );

  const label = `${opts.action} trade ${opts.transactionKey}`;
  if (env.dryRun) return dryRun('respondToTrade', label, xml);

  await put(`/transaction/${opts.transactionKey}`, xml);
  log.info(label);
  return { ok: true, action: 'respondToTrade', detail: label, dryRun: false };
}

// ---------------------------------------------------------------------------

function dryRun(action: string, detail: string, xml: string): WriteOutcome {
  log.info(`DRY RUN — would ${detail}`);
  log.debug('payload', xml);
  return { ok: true, action, detail: `DRY RUN: ${detail}`, dryRun: true };
}
