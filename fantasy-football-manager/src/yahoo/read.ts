/**
 * Read layer: every GET we need, mapped from Yahoo's JSON into the domain
 * types in ./types.ts.
 */

import { get } from './client.js';
import {
  fantasyContent, mergeAll, listOf, pluck, asObject, num, str, bool, findFragment, type Json,
} from './parse.js';
import type {
  League, LeagueSettings, Team, Player, Roster, Transaction, TransactionPlayer,
  Matchup, Standing, RosterSlot, StatCategory, PlayerRank,
} from './types.js';
import { env } from '../config.js';
import { logger } from '../util/log.js';

const log = logger('yahoo:read');

/** Yahoo caps player pages at 25. */
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapLeague(node: unknown): League {
  const l = mergeAll(node);
  return {
    leagueKey: str(l.league_key),
    leagueId: str(l.league_id),
    name: str(l.name),
    numTeams: num(l.num_teams),
    currentWeek: num(l.current_week),
    startWeek: num(l.start_week, 1),
    endWeek: num(l.end_week, 17),
    season: str(l.season),
    waiverType: str(l.waiver_type),
    waiverRule: str(l.waiver_rule),
    usesFaab: bool(l.uses_faab),
    scoringType: str(l.scoring_type),
    isFinished: bool(l.is_finished),
    url: str(l.url) || undefined,
  };
}

export function mapPlayer(node: unknown): Player {
  const p = mergeAll(node);
  const name = asObject(p.name);
  const selected = mergeAll(p.selected_position);
  const owned = mergeAll(p.percent_owned);
  const ownership = mergeAll(p.ownership);
  const byes = asObject(p.bye_weeks);

  const ranks: PlayerRank[] = Array.isArray(p.player_ranks)
    ? (p.player_ranks as unknown[]).map((r) => {
        const pr = asObject((r as Json)?.player_rank ?? r);
        return {
          rankType: str(pr.rank_type),
          rankValue: num(pr.rank_value, Number.NaN),
          rankSeason: str(pr.rank_season) || undefined,
        };
      }).filter((r) => Number.isFinite(r.rankValue))
    : [];

  const player: Player = {
    playerKey: str(p.player_key),
    playerId: str(p.player_id),
    name: str(name.full) || `${str(name.first)} ${str(name.last)}`.trim(),
    firstName: str(name.first),
    lastName: str(name.last),
    team: str(p.editorial_team_abbr).toUpperCase(),
    teamFullName: str(p.editorial_team_full_name) || undefined,
    displayPosition: str(p.display_position),
    primaryPosition: str(p.primary_position) || str(p.display_position),
    positionType: str(p.position_type),
    eligiblePositions: pluck(p.eligible_positions, 'position'),
    byeWeek: byes.week !== undefined ? num(byes.week, Number.NaN) || undefined : undefined,
    status: str(p.status),
    statusFull: str(p.status_full) || undefined,
    injuryNote: str(p.injury_note) || undefined,
    onDisabledList: bool(p.on_disabled_list),
    isUndroppable: bool(p.is_undroppable),
    uniformNumber: str(p.uniform_number) || undefined,
    selectedPosition: str(selected.position) || undefined,
    ranks,
  };

  if (owned.value !== undefined) player.percentOwned = num(owned.value, Number.NaN);
  if (owned.delta !== undefined) player.percentOwnedDelta = num(owned.delta, 0);
  if (ownership.ownership_type !== undefined) player.ownership = str(ownership.ownership_type);
  if (ownership.waiver_date !== undefined) player.waiverDate = str(ownership.waiver_date);

  // Stats/points arrive only when the caller asked for them.
  const stats = asObject(p.player_stats);
  if (stats.stats) {
    const m = new Map<number, number>();
    const raw = (stats.stats as Json)?.stat ?? (stats.stats as unknown);
    if (Array.isArray(raw)) {
      for (const s of raw) {
        const st = asObject((s as Json)?.stat ?? s);
        const id = num(st.stat_id, Number.NaN);
        if (Number.isFinite(id)) m.set(id, num(st.value, 0));
      }
    }
    player.stats = m;
  }
  const pts = asObject(p.player_points);
  if (pts.total !== undefined) player.points = num(pts.total, 0);

  return player;
}

function mapTeam(node: unknown): Team {
  const t = mergeAll(node);
  const managers = Array.isArray(t.managers)
    ? (t.managers as unknown[]).map((m) => asObject((m as Json)?.manager ?? m))
    : [];
  return {
    teamKey: str(t.team_key),
    teamId: str(t.team_id),
    name: str(t.name),
    isOwnedByCurrentLogin: bool(t.is_owned_by_current_login),
    waiverPriority: t.waiver_priority !== undefined ? num(t.waiver_priority, Number.NaN) : undefined,
    faabBalance: t.faab_balance !== undefined ? num(t.faab_balance, Number.NaN) : undefined,
    numberOfMoves: num(t.number_of_moves),
    numberOfTrades: num(t.number_of_trades),
    managerNicknames: managers.map((m) => str(m.nickname)).filter(Boolean),
    url: str(t.url) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

/** Every league the authorised user plays in for the given game (default NFL). */
export async function getMyLeagues(gameKey = env.gameKey): Promise<League[]> {
  const body = await get(`/users;use_login=1/games;game_keys=${gameKey}/leagues`);
  const fc = fantasyContent(body);
  const users = listOf(fc.users, 'user');
  const out: League[] = [];
  for (const user of users) {
    for (const game of listOf(user.games, 'game')) {
      for (const league of listOf(game.leagues, 'league')) {
        out.push(mapLeague(league));
      }
    }
  }
  return out;
}

export function resolveLeagueKey(explicit?: string): string {
  const key = explicit ?? env.leagueKey;
  if (!key) {
    throw new Error(
      'No league key. Pass one, or set YAHOO_LEAGUE_KEY in .env (find it with `npm run league -- list`).',
    );
  }
  return key;
}

export async function getLeagueSettings(leagueKey?: string): Promise<LeagueSettings> {
  const key = resolveLeagueKey(leagueKey);
  const body = await get(`/league/${key}/settings`);
  const fc = fantasyContent(body);
  const leagueNode = fc.league;
  const league = mapLeague(leagueNode);
  const settings = mergeAll(findFragment(leagueNode, 'settings'));

  const rosterSlots: RosterSlot[] = Array.isArray(settings.roster_positions)
    ? (settings.roster_positions as unknown[]).map((r) => {
        const rp = asObject((r as Json)?.roster_position ?? r);
        return {
          position: str(rp.position),
          positionType: str(rp.position_type) || undefined,
          count: num(rp.count, 0),
        };
      })
    : [];

  const statCategories: StatCategory[] = [];
  const catNode = asObject(settings.stat_categories);
  const catStats = (asObject(catNode.stats).stat ?? catNode.stats) as unknown;
  if (Array.isArray(catStats)) {
    for (const s of catStats) {
      const st = asObject((s as Json)?.stat ?? s);
      statCategories.push({
        statId: num(st.stat_id, Number.NaN),
        name: str(st.name),
        displayName: str(st.display_name),
        positionTypes: pluck(st.position_types, 'position_type'),
        enabled: st.enabled === undefined ? true : bool(st.enabled),
      });
    }
  }

  const statModifiers = new Map<number, number>();
  const modNode = asObject(settings.stat_modifiers);
  const modStats = (asObject(modNode.stats).stat ?? modNode.stats) as unknown;
  if (Array.isArray(modStats)) {
    for (const s of modStats) {
      const st = asObject((s as Json)?.stat ?? s);
      const id = num(st.stat_id, Number.NaN);
      if (Number.isFinite(id)) statModifiers.set(id, num(st.value, 0));
    }
  }

  const startingSlots = rosterSlots.filter((s) => !isBenchSlot(s.position));
  const benchCount = rosterSlots.find((s) => s.position === 'BN')?.count ?? 0;
  const irCount = rosterSlots
    .filter((s) => s.position === 'IR' || s.position === 'IR+')
    .reduce((a, s) => a + s.count, 0);

  return { league, rosterSlots, statCategories, statModifiers, startingSlots, benchCount, irCount };
}

export function isBenchSlot(position: string): boolean {
  return position === 'BN' || position === 'IR' || position === 'IR+' || position === 'IL';
}

// ---------------------------------------------------------------------------
// Teams and rosters
// ---------------------------------------------------------------------------

export async function getTeams(leagueKey?: string): Promise<Team[]> {
  const key = resolveLeagueKey(leagueKey);
  const body = await get(`/league/${key}/teams`);
  const fc = fantasyContent(body);
  const teamsNode = findFragment(fc.league, 'teams');
  return listOf(teamsNode, 'team').map(mapTeam);
}

/**
 * The authorised user's team in a league. Yahoo flags it with
 * is_owned_by_current_login on the teams collection.
 */
export async function getMyTeam(leagueKey?: string): Promise<Team> {
  const key = resolveLeagueKey(leagueKey);
  const teams = await getTeams(key);
  const mine = teams.find((t) => t.isOwnedByCurrentLogin);
  if (mine) return mine;

  // Fallback: ask Yahoo directly which teams belong to the login.
  const body = await get(`/users;use_login=1/games;game_keys=${env.gameKey}/teams`);
  const fc = fantasyContent(body);
  for (const user of listOf(fc.users, 'user')) {
    for (const game of listOf(user.games, 'game')) {
      for (const team of listOf(game.teams, 'team')) {
        const mapped = mapTeam(team);
        if (mapped.teamKey.startsWith(`${key}.`)) return mapped;
      }
    }
  }
  throw new Error(`Could not identify your team in league ${key}`);
}

export async function getRoster(teamKey: string, week?: number): Promise<Roster> {
  const suffix = week ? `;week=${week}` : '';
  const body = await get(`/team/${teamKey}/roster${suffix}`);
  const fc = fantasyContent(body);
  const rosterNode = asObject(findFragment(fc.team, 'roster'));
  // Yahoo nests the player collection one level deeper under "0" on rosters.
  const playersNode = rosterNode.players ?? asObject(rosterNode['0']).players;
  return {
    teamKey,
    week: num(rosterNode.week, week ?? 0),
    isEditable: bool(rosterNode.is_editable),
    players: listOf(playersNode, 'player').map(mapPlayer),
  };
}

/** Roster plus this-week fantasy points for each player. */
export async function getRosterWithStats(teamKey: string, week: number): Promise<Roster> {
  const body = await get(`/team/${teamKey}/roster;week=${week}/players/stats;type=week;week=${week}`);
  const fc = fantasyContent(body);
  const rosterNode = asObject(findFragment(fc.team, 'roster'));
  const playersNode = rosterNode.players ?? asObject(rosterNode['0']).players;
  return {
    teamKey,
    week,
    isEditable: bool(rosterNode.is_editable),
    players: listOf(playersNode, 'player').map(mapPlayer),
  };
}

// ---------------------------------------------------------------------------
// Player pool
// ---------------------------------------------------------------------------

export interface PlayerQuery {
  /** "FA" free agents, "W" on waivers, "A" all available, "T" taken. */
  status?: 'FA' | 'W' | 'A' | 'T' | 'K';
  position?: string;
  /** "OR" overall rank, "AR" actual season rank, "PTS", "PR" preseason. */
  sort?: 'OR' | 'AR' | 'PTS' | 'PR' | 'NAME';
  sortType?: 'season' | 'lastweek' | 'lastmonth' | 'week';
  sortWeek?: number;
  search?: string;
  /** Total players to fetch across pages. */
  limit?: number;
  start?: number;
}

function playerFilters(q: PlayerQuery): string {
  const parts: string[] = [];
  if (q.status) parts.push(`status=${q.status}`);
  if (q.position) parts.push(`position=${q.position}`);
  if (q.sort) parts.push(`sort=${q.sort}`);
  if (q.sortType) parts.push(`sort_type=${q.sortType}`);
  if (q.sortWeek) parts.push(`sort_week=${q.sortWeek}`);
  if (q.search) parts.push(`search=${encodeURIComponent(q.search)}`);
  return parts.length ? `;${parts.join(';')}` : '';
}

/**
 * Page through the league player pool.
 *
 * `out=percent_owned,ownership` gives us the crowd signal and tells us whether
 * a player is a true free agent or still sitting on waivers — the single most
 * important distinction for a priority league. Some Yahoo league types reject
 * the `out` parameter, so we retry once without it.
 */
export async function getPlayers(leagueKey: string | undefined, q: PlayerQuery = {}): Promise<Player[]> {
  const key = resolveLeagueKey(leagueKey);
  const limit = q.limit ?? PAGE_SIZE;
  const filters = playerFilters(q);
  const out: Player[] = [];
  let start = q.start ?? 0;
  let useOut = true;

  while (out.length < limit) {
    const count = Math.min(PAGE_SIZE, limit - out.length);
    const sub = useOut ? '/;out=percent_owned,ownership' : '';
    const path = `/league/${key}/players${filters};start=${start};count=${count}${sub}`;

    let page: Player[];
    try {
      page = await fetchPlayerPage(path);
    } catch (e) {
      if (useOut) {
        log.warn('players?out=… rejected, retrying without sub-resources', String(e));
        useOut = false;
        continue;
      }
      throw e;
    }

    out.push(...page);
    if (page.length < count) break; // pool exhausted
    start += count;
  }
  return out;
}

async function fetchPlayerPage(path: string): Promise<Player[]> {
  const body = await get(path);
  const fc = fantasyContent(body);
  const playersNode = findFragment(fc.league, 'players');
  return listOf(playersNode, 'player').map(mapPlayer);
}

/** Available = free agents + players currently on waivers. */
export async function getAvailablePlayers(
  leagueKey: string | undefined,
  q: Omit<PlayerQuery, 'status'> = {},
): Promise<Player[]> {
  return getPlayers(leagueKey, { ...q, status: 'A', sort: q.sort ?? 'AR' });
}

export async function getFreeAgents(
  leagueKey: string | undefined,
  q: Omit<PlayerQuery, 'status'> = {},
): Promise<Player[]> {
  return getPlayers(leagueKey, { ...q, status: 'FA', sort: q.sort ?? 'AR' });
}

export async function getWaiverPlayers(
  leagueKey: string | undefined,
  q: Omit<PlayerQuery, 'status'> = {},
): Promise<Player[]> {
  return getPlayers(leagueKey, { ...q, status: 'W', sort: q.sort ?? 'AR' });
}

/** Look up specific players by key, optionally with stats for a window. */
export async function getPlayersByKeys(
  leagueKey: string | undefined,
  playerKeys: string[],
  stats?: { type: 'season' | 'week' | 'lastweek' | 'lastmonth' | 'average_season'; week?: number },
): Promise<Player[]> {
  if (playerKeys.length === 0) return [];
  const key = resolveLeagueKey(leagueKey);
  const out: Player[] = [];

  // Yahoo accepts up to 25 keys per call.
  for (let i = 0; i < playerKeys.length; i += PAGE_SIZE) {
    const chunk = playerKeys.slice(i, i + PAGE_SIZE);
    let sub = '/;out=percent_owned,ownership';
    if (stats) {
      const weekPart = stats.week ? `;week=${stats.week}` : '';
      sub = `/stats;type=${stats.type}${weekPart}`;
    }
    const path = `/league/${key}/players;player_keys=${chunk.join(',')}${sub}`;
    out.push(...(await fetchPlayerPage(path)));
  }
  return out;
}

/** Fantasy points for players over a window, as scored by this league. */
export async function getPlayerStats(
  leagueKey: string | undefined,
  playerKeys: string[],
  type: 'season' | 'week' | 'lastweek' | 'lastmonth' | 'average_season' = 'season',
  week?: number,
): Promise<Player[]> {
  return getPlayersByKeys(leagueKey, playerKeys, { type, week });
}

// ---------------------------------------------------------------------------
// Transactions, matchups, standings
// ---------------------------------------------------------------------------

export async function getTransactions(
  leagueKey?: string,
  opts: { types?: string[]; count?: number; teamKey?: string } = {},
): Promise<Transaction[]> {
  const key = resolveLeagueKey(leagueKey);
  const filters: string[] = [];
  if (opts.types?.length) filters.push(`types=${opts.types.join(',')}`);
  if (opts.teamKey) filters.push(`team_key=${opts.teamKey}`);
  if (opts.count) filters.push(`count=${opts.count}`);
  const suffix = filters.length ? `;${filters.join(';')}` : '';

  const body = await get(`/league/${key}/transactions${suffix}`);
  const fc = fantasyContent(body);
  const node = findFragment(fc.league, 'transactions');

  return listOf(node, 'transaction').map((t): Transaction => {
    const players: TransactionPlayer[] = listOf(t.players, 'player').map((p) => {
      const data = mergeAll(p.transaction_data);
      const name = asObject(p.name);
      return {
        playerKey: str(p.player_key),
        name: str(name.full),
        position: str(p.display_position),
        type: str(data.type),
        sourceType: str(data.source_type) || undefined,
        destinationType: str(data.destination_type) || undefined,
        destinationTeamKey: str(data.destination_team_key) || undefined,
        sourceTeamKey: str(data.source_team_key) || undefined,
      };
    });
    return {
      transactionKey: str(t.transaction_key),
      transactionId: str(t.transaction_id),
      type: str(t.type),
      status: str(t.status),
      timestamp: num(t.timestamp) * 1000,
      players,
      traderTeamKey: str(t.trader_team_key) || undefined,
      tradeeTeamKey: str(t.tradee_team_key) || undefined,
      tradeNote: str(t.trade_note) || undefined,
    };
  });
}

/** Pending trade proposals aimed at, or sent by, the authorised user. */
export async function getPendingTrades(leagueKey?: string): Promise<Transaction[]> {
  const all = await getTransactions(leagueKey, { types: ['pending_trade'], count: 25 });
  return all.filter((t) => t.type.includes('trade'));
}

export async function getScoreboard(leagueKey?: string, week?: number): Promise<Matchup[]> {
  const key = resolveLeagueKey(leagueKey);
  const suffix = week ? `;week=${week}` : '';
  const body = await get(`/league/${key}/scoreboard${suffix}`);
  const fc = fantasyContent(body);
  const sb = asObject(findFragment(fc.league, 'scoreboard'));
  const matchupsNode = sb.matchups ?? asObject(sb['0']).matchups;

  return listOf(matchupsNode, 'matchup').map((m): Matchup => {
    const teamsNode = m.teams ?? asObject(m['0']).teams;
    const teams = listOf(teamsNode, 'team').map((t) => {
      const pts = mergeAll(t.team_points);
      const proj = mergeAll(t.team_projected_points);
      return {
        teamKey: str(t.team_key),
        name: str(t.name),
        points: num(pts.total, 0),
        projectedPoints: num(proj.total, 0),
      };
    });
    return { week: num(m.week), status: str(m.status), teams };
  });
}

export async function getStandings(leagueKey?: string): Promise<Standing[]> {
  const key = resolveLeagueKey(leagueKey);
  const body = await get(`/league/${key}/standings`);
  const fc = fantasyContent(body);
  const standingsNode = asObject(findFragment(fc.league, 'standings'));
  const teamsNode = standingsNode.teams ?? asObject(standingsNode['0']).teams;

  return listOf(teamsNode, 'team').map((t): Standing => {
    const outcome = asObject(mergeAll(t.team_standings).outcome_totals);
    const ts = mergeAll(t.team_standings);
    return {
      teamKey: str(t.team_key),
      name: str(t.name),
      rank: num(ts.rank, 0),
      wins: num(outcome.wins),
      losses: num(outcome.losses),
      ties: num(outcome.ties),
      pointsFor: num(ts.points_for),
      pointsAgainst: num(ts.points_against),
    };
  });
}

/**
 * Waiver priority for every team, lowest number = next claim.
 * In a priority league this is the scarce resource the whole strategy turns on.
 */
export async function getWaiverPriorities(leagueKey?: string): Promise<Team[]> {
  const teams = await getTeams(leagueKey);
  return teams
    .filter((t) => t.waiverPriority !== undefined && Number.isFinite(t.waiverPriority))
    .sort((a, b) => (a.waiverPriority ?? 0) - (b.waiverPriority ?? 0));
}
