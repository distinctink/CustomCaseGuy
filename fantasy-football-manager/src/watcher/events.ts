/**
 * News interpretation: ESPN feed -> "which player on the wire just got more
 * valuable, and why".
 *
 * The chain that matters is indirect. ESPN tells us a starting running back is
 * Out; what we need is the name of his backup, who is sitting unowned in our
 * league. That mapping is built from the injured player's team and position,
 * refined by ESPN's depth chart when one is available.
 */

import type { InjuryRecord, NewsItem } from '../espn/types.js';
import { getDepthChart, teamByAbbr, injuryCode } from '../espn/api.js';
import { matchPlayer, normalizeTeam, normalizeName, type Nameable } from '../util/names.js';
import { primaryFantasyPosition } from '../engine/valuation.js';
import type { RoleSignal } from '../engine/decide.js';
import type { DecisionContext } from '../engine/context.js';
import type { Player } from '../yahoo/types.js';
import { eventHash } from '../store/state.js';
import { logger } from '../util/log.js';

const log = logger('watcher:events');

/** Designations severe enough that the player's workload moves to someone else. */
const SIDELINING = new Set(['O', 'IR', 'PUP', 'SUSP', 'D']);

export interface MaterialEvent {
  hash: string;
  kind: 'injury' | 'news';
  /** The player the news is about. */
  subject: string;
  team: string;
  position: string;
  headline: string;
  publishedMs: number;
  /** Injury code after the change, when this is an injury event. */
  status?: string;
}

/**
 * Headline patterns worth waking up for. Deliberately narrow — most NFL news
 * is not actionable, and a chatty trigger burns the daily transaction budget
 * on noise.
 */
const ACTIONABLE = [
  /\bruled out\b/i,
  /\bplaced on (the )?injured reserve\b/i,
  /\bto ir\b/i,
  /\bwill (not )?(play|start)\b/i,
  /\bnamed (the )?starter\b/i,
  /\bexpected to (start|miss|be out)\b/i,
  /\bout for the season\b/i,
  /\btorn (acl|achilles|mcl)\b/i,
  /\bwaived\b/i,
  /\breleased\b/i,
  /\bsuspended\b/i,
  /\bactivated\b/i,
  /\breturn(s|ing)? (to practice|from)\b/i,
  /\bcarted off\b/i,
  /\bdid not practice\b/i,
  /\btrade[ds]? to\b/i,
  /\bpromoted\b/i,
  /\bbenched\b/i,
];

export function isActionableHeadline(text: string): boolean {
  return ACTIONABLE.some((re) => re.test(text));
}

/**
 * Diff the current injury table against what we saw last time. Only genuine
 * transitions are material — a player who has been Out for three weeks is not
 * news any more.
 */
export function injuryEvents(
  current: InjuryRecord[],
  previous: Map<string, string>,
): { events: MaterialEvent[]; snapshot: Map<string, string> } {
  const snapshot = new Map<string, string>();
  const events: MaterialEvent[] = [];

  for (const row of current) {
    const key = row.athleteId || `${row.name}|${row.team}`;
    snapshot.set(key, row.code);

    const before = previous.get(key);
    if (before === row.code) continue;
    // First run: record the baseline without firing on the whole league.
    if (before === undefined && previous.size === 0) continue;
    // Only react when the player becomes *less* available, or returns outright.
    const worsened = SIDELINING.has(row.code) && !SIDELINING.has(before ?? '');
    const recovered = !row.code && SIDELINING.has(before ?? '');
    if (!worsened && !recovered) continue;

    events.push({
      hash: eventHash(['injury', key, before ?? '', row.code]),
      kind: 'injury',
      subject: row.name,
      team: normalizeTeam(row.team),
      position: row.position,
      headline: recovered
        ? `${row.name} (${row.team}) is back to active from ${before}`
        : `${row.name} (${row.team}) is now ${row.status}${row.detail ? ` — ${row.detail}` : ''}`,
      publishedMs: row.dateMs ?? Date.now(),
      status: row.code,
    });
  }

  return { events, snapshot };
}

/** Turn the general news feed into material events. */
export function newsEvents(items: NewsItem[], maxAgeMinutes: number): MaterialEvent[] {
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const events: MaterialEvent[] = [];

  for (const item of items) {
    if (item.publishedMs && item.publishedMs < cutoff) continue;
    const text = `${item.headline} ${item.description}`;
    if (!isActionableHeadline(text)) continue;

    for (const athlete of item.athletes) {
      events.push({
        hash: eventHash(['news', item.id, athlete.id]),
        kind: 'news',
        subject: athlete.name,
        team: normalizeTeam(athlete.team),
        position: athlete.position ?? '',
        headline: item.headline,
        publishedMs: item.publishedMs || Date.now(),
        status: /ruled out|injured reserve|out for the season/i.test(text) ? 'O' : undefined,
      });
    }

    // Team-level news with no tagged athlete still matters (a backfield split,
    // a QB change), but we cannot act without a player, so log and move on.
    if (!item.athletes.length && item.teams.length) {
      log.debug(`untagged team news skipped: ${item.headline}`);
    }
  }
  return events;
}

/**
 * The interesting inference: given that `event.subject` is sidelined, who on
 * the wire inherits the work?
 *
 * Preference order:
 *   1. ESPN depth chart for that team and position, best available rank
 *   2. Failing that, the highest-valued available player on the same team at a
 *      compatible position
 */
export async function beneficiaries(
  event: MaterialEvent,
  ctx: DecisionContext,
  season: number,
): Promise<RoleSignal[]> {
  if (!event.team) return [];

  const position = canonicalPosition(event.position);
  if (!position || position === 'K' || position === 'DEF') return [];

  // A player coming back is worth something to *himself*, not to a backup.
  if (isReturn(event)) {
    const returning = ctx.available.find(
      (p) => normalizeTeam(p.team) === event.team && matchesName(p.name, event.subject),
    );
    if (!returning) return [];
    return [{
      playerKey: returning.playerKey,
      roleChange: 'returning_from_injury',
      source: `${event.headline} → ${returning.name} is available again`,
      injuryStatus: '',
    }];
  }

  const sidelined = event.status ? SIDELINING.has(event.status) : false;
  if (!sidelined) return [];

  const sameTeam = ctx.available.filter(
    (p) => normalizeTeam(p.team) === event.team && positionMatches(p, position),
  );
  if (!sameTeam.length) return [];

  const ranked = await rankByDepthChart(sameTeam, event.team, position, season);

  // Only the immediate backup gets the promotion bonus; the third-stringer
  // inheriting a committee role is not the same bet.
  const top = ranked[0];
  if (!top) return [];

  const roleChange = roleChangeFor(position, event, ranked.length);

  return [
    {
      playerKey: top.playerKey,
      roleChange,
      source: `${event.headline} → ${top.name} is next up at ${position} for ${event.team}`,
    },
  ];
}

/** News about a player coming back rather than going down. */
function isReturn(event: MaterialEvent): boolean {
  if (event.status === '') return /back to active|activated|return/i.test(event.headline);
  return /\bactivated\b|\breturn(s|ing)? (to practice|from)\b/i.test(event.headline);
}

function matchesName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

async function rankByDepthChart(
  players: Player[],
  teamAbbr: string,
  position: string,
  season: number,
): Promise<Player[]> {
  try {
    const team = await teamByAbbr(teamAbbr);
    if (!team) throw new Error(`no ESPN team for ${teamAbbr}`);
    const chart = await getDepthChart(team.id, season, teamAbbr);
    const relevant = chart.filter((e) => canonicalPosition(e.position) === position);
    if (!relevant.length) throw new Error('empty depth chart for position');

    const withRank = players
      .map((p) => {
        const nameables: Nameable[] = relevant.map((e) => ({ name: e.name, team: e.team, position: e.position }));
        const hit = matchPlayer({ name: p.name, team: p.team, position }, nameables);
        const rank = hit ? relevant.find((e) => e.name === hit.value.name)?.rank ?? 99 : 99;
        return { player: p, rank };
      })
      .sort((a, b) => a.rank - b.rank);

    if (withRank[0] && withRank[0].rank < 99) return withRank.map((w) => w.player);
    throw new Error('no depth-chart match among available players');
  } catch (e) {
    log.debug(`depth chart unavailable for ${teamAbbr} ${position}, falling back to value`, String(e));
    return players;
  }
}

/**
 * Which role-change bonus applies.
 *
 * A backfield that already splits work does not hand the whole job to one man
 * when the nominal starter goes down, so a crowded depth chart gets the smaller
 * committee bonus rather than the full promotion.
 */
function roleChangeFor(position: string, event: MaterialEvent, contenders: number): string {
  if (position === 'RB') {
    // A season-ending designation hands over the whole job even in a crowded
    // backfield; a week-to-week absence usually just widens the split.
    if (event.status === 'IR' || event.status === 'PUP') return 'starter_out_backup_promoted';
    return contenders > 1 ? 'committee_to_bellcow' : 'starter_out_backup_promoted';
  }
  if (position === 'WR') return 'wr2_to_wr1';
  if (position === 'TE') return 'te_starter_out';
  if (position === 'QB') return 'qb_starter_change';
  return 'starter_out_backup_promoted';
}

function canonicalPosition(pos: string): string {
  const up = (pos || '').toUpperCase();
  if (up === 'DST' || up === 'D/ST' || up === 'DEF') return 'DEF';
  if (up === 'PK') return 'K';
  if (up === 'FB' || up === 'HB') return 'RB';
  if (up === 'WR' || up === 'RB' || up === 'TE' || up === 'QB' || up === 'K' || up === 'DEF') return up;
  return up;
}

function positionMatches(player: Player, position: string): boolean {
  return primaryFantasyPosition(player) === position || player.eligiblePositions.includes(position);
}

/** Is this event about a player already on my roster? */
export function affectsMyRoster(event: MaterialEvent, ctx: DecisionContext): Player | undefined {
  const hit = matchPlayer(
    { name: event.subject, team: event.team, position: event.position },
    ctx.roster.players.map((p) => ({ name: p.name, team: p.team, position: p.displayPosition, ref: p })),
  );
  return (hit?.value as { ref?: Player } | undefined)?.ref;
}
