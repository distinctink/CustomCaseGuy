/**
 * Builds the full decision context: my league, my roster, the available player
 * pool, waiver priorities and rival activity — all valued under my scoring
 * rules.
 *
 * Assembling this costs a dozen Yahoo calls, so it is cached briefly and reused
 * across the candidates produced by a single news burst.
 */

import {
  getLeagueSettings, getMyTeam, getRoster, getAvailablePlayers, getTeams,
  getTransactions, getPlayerStats, resolveLeagueKey,
} from '../yahoo/read.js';
import type { LeagueSettings, Player, Roster, Team, Transaction } from '../yahoo/types.js';
import { loadStrategy, type StrategyConfig } from '../config.js';
import { valuePlayer, perGame, type Valuation } from './valuation.js';
import { playerPoints } from './scoring.js';
import { analyseRoster, type RosterAnalysis } from './roster.js';
import { activeRivalTeams, type WaiverContext } from './waiver.js';
import { logger } from '../util/log.js';

const log = logger('engine:context');

export interface DecisionContext {
  leagueKey: string;
  settings: LeagueSettings;
  myTeam: Team;
  roster: Roster;
  teams: Team[];
  transactions: Transaction[];
  /** Free agents and players on waivers, valued. */
  available: Player[];
  valuations: Map<string, Valuation>;
  rosterAnalysis: RosterAnalysis;
  waiver: WaiverContext;
  strategy: StrategyConfig;
  currentWeek: number;
  weeksRemaining: number;
  builtAt: number;
}

let cached: DecisionContext | undefined;

/** How long a built context stays usable before we refetch. */
const CONTEXT_TTL_MS = 90_000;

export function invalidateContext(): void {
  cached = undefined;
}

export async function buildContext(opts: {
  leagueKey?: string;
  /** How deep to scan the available pool. 75 covers anyone worth adding. */
  poolSize?: number;
  force?: boolean;
} = {}): Promise<DecisionContext> {
  if (!opts.force && cached && Date.now() - cached.builtAt < CONTEXT_TTL_MS) return cached;

  const leagueKey = resolveLeagueKey(opts.leagueKey);
  const strategy = loadStrategy();
  const poolSize = opts.poolSize ?? 75;

  const settings = await getLeagueSettings(leagueKey);
  const currentWeek = settings.league.currentWeek || settings.league.startWeek;
  const weeksRemaining = Math.max(
    0,
    Math.min(strategy.waiver.regularSeasonWeeks, settings.league.endWeek - currentWeek + 1),
  );

  const [myTeam, teams, transactions, available] = await Promise.all([
    getMyTeam(leagueKey),
    getTeams(leagueKey),
    getTransactions(leagueKey, { count: 25 }),
    getAvailablePlayers(leagueKey, { limit: poolSize, sort: 'AR' }),
  ]);

  const roster = await getRoster(myTeam.teamKey, currentWeek);

  const valuations = await valueAll(
    leagueKey,
    [...roster.players, ...available],
    settings,
    strategy,
    currentWeek,
  );

  const rosterAnalysis = analyseRoster({ roster, valuations, settings, strategy });

  const rivals = activeRivalTeams(teams, transactions, myTeam.teamKey, strategy);
  const waiver: WaiverContext = {
    myPriority: myTeam.waiverPriority ?? teams.length,
    numTeams: teams.length || settings.league.numTeams,
    activeRivalPriorities: rivals
      .map((t) => t.waiverPriority)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p)),
    weeksRemaining,
  };

  log.info(
    `context built: week ${currentWeek}, priority #${waiver.myPriority}/${waiver.numTeams}, ` +
      `${available.length} available, ${rivals.length} active rivals`,
  );

  cached = {
    leagueKey, settings, myTeam, roster, teams, transactions, available,
    valuations, rosterAnalysis, waiver, strategy, currentWeek, weeksRemaining,
    builtAt: Date.now(),
  };
  return cached;
}

/**
 * Value every player we care about.
 *
 * Yahoo's per-game averages are the cheapest useful signal: one batched call
 * for the season and one for the trailing month gives us both the baseline and
 * the recent-form component of the blend.
 */
export async function valueAll(
  leagueKey: string,
  players: Player[],
  settings: LeagueSettings,
  strategy: StrategyConfig,
  currentWeek: number,
): Promise<Map<string, Valuation>> {
  const keys = [...new Set(players.map((p) => p.playerKey))].filter(Boolean);
  const seasonPts = new Map<string, number>();
  const recentPts = new Map<string, number>();

  try {
    const season = await getPlayerStats(leagueKey, keys, 'season');
    for (const p of season) seasonPts.set(p.playerKey, playerPoints(p, settings));
  } catch (e) {
    log.warn('season stats unavailable; falling back to rank-based valuation', String(e));
  }

  try {
    const recent = await getPlayerStats(leagueKey, keys, 'lastmonth');
    for (const p of recent) recentPts.set(p.playerKey, playerPoints(p, settings));
  } catch (e) {
    log.warn('trailing-month stats unavailable; using season only', String(e));
  }

  // Games played is not exposed directly, so approximate from the week number.
  const gamesSoFar = Math.max(1, currentWeek - 1);
  const recentWindow = Math.max(1, Math.min(strategy.valuation.recentWindowGames, gamesSoFar));

  const out = new Map<string, Valuation>();
  for (const player of players) {
    if (out.has(player.playerKey)) continue;
    const seasonTotal = seasonPts.get(player.playerKey) ?? 0;
    const recentTotal = recentPts.get(player.playerKey);

    const seasonPPG = perGame(seasonTotal, gamesSoFar);
    const recentPPG = recentTotal === undefined ? seasonPPG : perGame(recentTotal, recentWindow);

    out.set(
      player.playerKey,
      valuePlayer(
        { player, seasonPPG, recentPPG, gamesPlayed: gamesSoFar, currentWeek },
        settings,
        strategy,
      ),
    );
  }
  return out;
}
