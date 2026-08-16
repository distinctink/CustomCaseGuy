/**
 * Builds the full decision context: my league, my roster, every rival roster,
 * the available player pool, waiver priorities and rival activity — all valued
 * under my scoring rules.
 *
 * Rival rosters cost a dozen extra calls but are load-bearing in two places:
 * positional ranks are only meaningful across the whole player universe (a free
 * agent who looks like WR1 of the wire might be WR55 overall), and trade ideas
 * are impossible without knowing what everyone else is short of.
 *
 * Assembling this is expensive, so it is cached briefly and reused across the
 * candidates produced by a single news burst.
 */

import {
  getLeagueSettings, getMyTeam, getRoster, getAvailablePlayers, getTeams,
  getTransactions, getPlayerStats, resolveLeagueKey,
} from '../yahoo/read.js';
import type { LeagueSettings, Player, Roster, Team, Transaction } from '../yahoo/types.js';
import { loadStrategy, type StrategyConfig } from '../config.js';
import { valuePlayer, perGame, type Valuation } from './valuation.js';
import { playerPoints } from './scoring.js';
import { baselinePPG, positionalRanks, blendWithProduction, productionConfidence } from './baseline.js';
import { analyseRoster, type RosterAnalysis } from './roster.js';
import { activeRivalTeams, type WaiverContext } from './waiver.js';
import { profileTeam, type TeamProfile } from './trades.js';
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
  /** Every rostered player plus the available pool — the universe for ranking. */
  universe: Player[];
  /** teamKey -> roster, for every team in the league. */
  allRosters: Map<string, Roster>;
  /** Positional strength profiles, used for trade ideas. */
  profiles: Map<string, TeamProfile>;
  valuations: Map<string, Valuation>;
  rosterAnalysis: RosterAnalysis;
  waiver: WaiverContext;
  strategy: StrategyConfig;
  currentWeek: number;
  weeksRemaining: number;
  /** Games completed so far; 0 in preseason and week 1. */
  gamesPlayed: number;
  /** 0 = valuation is entirely prior-based, 1 = entirely production-based. */
  productionConfidence: number;
  builtAt: number;
}

let cached: DecisionContext | undefined;

/**
 * How long a built context stays usable before we refetch. Driven by
 * `execution.faRefreshSeconds` — material news calls `buildContext({force})`
 * anyway, so this only bounds how stale a routine read can be.
 */
function contextTtlMs(strategy: StrategyConfig): number {
  return Math.max(30, strategy.execution.faRefreshSeconds) * 1000;
}

export function invalidateContext(): void {
  cached = undefined;
}

export async function buildContext(opts: {
  leagueKey?: string;
  /** How deep to scan the available pool. 75 covers anyone worth adding. */
  poolSize?: number;
  force?: boolean;
  /** Skip rival rosters when we only need a quick read. */
  skipRivalRosters?: boolean;
} = {}): Promise<DecisionContext> {
  const strategy = loadStrategy();
  if (!opts.force && cached && Date.now() - cached.builtAt < contextTtlMs(strategy)) return cached;

  const leagueKey = resolveLeagueKey(opts.leagueKey);
  const poolSize = opts.poolSize ?? 75;

  const settings = await getLeagueSettings(leagueKey);
  const currentWeek = settings.league.currentWeek || settings.league.startWeek;
  const weeksRemaining = Math.max(
    0,
    Math.min(strategy.waiver.regularSeasonWeeks, settings.league.endWeek - currentWeek + 1),
  );
  // Week 1 means nothing has been played yet; this must be able to reach 0 or
  // the cold-start blend never kicks in.
  const gamesPlayed = Math.max(0, currentWeek - 1);

  const [myTeam, teams, transactions, available] = await Promise.all([
    getMyTeam(leagueKey),
    getTeams(leagueKey),
    getTransactions(leagueKey, { count: 25 }),
    getAvailablePlayers(leagueKey, { limit: poolSize, sort: 'AR' }),
  ]);

  const roster = await getRoster(myTeam.teamKey, currentWeek);

  // Rival rosters, fetched together. One failure should not sink the context.
  const allRosters = new Map<string, Roster>([[myTeam.teamKey, roster]]);
  if (!opts.skipRivalRosters) {
    const rivals = teams.filter((t) => t.teamKey !== myTeam.teamKey);
    const fetched = await Promise.allSettled(
      rivals.map((t) => getRoster(t.teamKey, currentWeek).then((r) => [t.teamKey, r] as const)),
    );
    for (const outcome of fetched) {
      if (outcome.status === 'fulfilled') allRosters.set(outcome.value[0], outcome.value[1]);
      else log.warn('could not fetch a rival roster', String(outcome.reason));
    }
  }

  const rostered = [...allRosters.values()].flatMap((r) => r.players);
  const universe = dedupePlayers([...rostered, ...available]);

  const valuations = await valueAll({
    leagueKey, universe, settings, strategy, gamesPlayed, currentWeek,
  });

  const rosterAnalysis = analyseRoster({ roster, valuations, settings, strategy });

  const profiles = new Map<string, TeamProfile>();
  for (const team of teams) {
    const teamRoster = allRosters.get(team.teamKey);
    if (teamRoster) profiles.set(team.teamKey, profileTeam(team, teamRoster, valuations, settings));
  }

  const activeRivals = activeRivalTeams(teams, transactions, myTeam.teamKey, strategy);
  const waiver: WaiverContext = {
    myPriority: myTeam.waiverPriority ?? teams.length,
    numTeams: teams.length || settings.league.numTeams,
    activeRivalPriorities: activeRivals
      .map((t) => t.waiverPriority)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p)),
    weeksRemaining,
  };

  const confidence = productionConfidence(gamesPlayed, strategy.valuation.productionRampGames);

  log.info(
    `context: week ${currentWeek}, priority #${waiver.myPriority}/${waiver.numTeams}, ` +
      `${available.length} available, ${universe.length} in universe, ` +
      `${activeRivals.length} active rivals, production confidence ${Math.round(confidence * 100)}%`,
  );

  cached = {
    leagueKey, settings, myTeam, roster, teams, transactions, available, universe,
    allRosters, profiles, valuations, rosterAnalysis, waiver, strategy,
    currentWeek, weeksRemaining, gamesPlayed, productionConfidence: confidence,
    builtAt: Date.now(),
  };
  return cached;
}

function dedupePlayers(players: Player[]): Player[] {
  const seen = new Map<string, Player>();
  for (const p of players) {
    if (!p.playerKey) continue;
    // A rostered copy carries selected_position, so prefer it over a pool copy.
    const existing = seen.get(p.playerKey);
    if (!existing || (!existing.selectedPosition && p.selectedPosition)) seen.set(p.playerKey, p);
  }
  return [...seen.values()];
}

/**
 * Value every player in the universe.
 *
 * Two sources, blended by how much football has actually been played:
 *   - production: Yahoo season and trailing-month points under our scoring
 *   - prior:      positional rank and rostered-% read off a scoring-adapted curve
 *
 * In preseason the prior is everything; by week 5 production has taken over.
 * Without the prior the engine simply does nothing before October, which is
 * when the waiver wire matters most.
 */
export async function valueAll(opts: {
  leagueKey: string;
  universe: Player[];
  settings: LeagueSettings;
  strategy: StrategyConfig;
  gamesPlayed: number;
  currentWeek: number;
}): Promise<Map<string, Valuation>> {
  const { leagueKey, universe, settings, strategy, gamesPlayed, currentWeek } = opts;
  const keys = [...new Set(universe.map((p) => p.playerKey))].filter(Boolean);

  const seasonPts = new Map<string, number>();
  const recentPts = new Map<string, number>();

  // Skip the stat calls entirely when no football has been played — they would
  // return zeros and cost a dozen requests for nothing.
  if (gamesPlayed > 0) {
    try {
      const season = await getPlayerStats(leagueKey, keys, 'season');
      for (const p of season) seasonPts.set(p.playerKey, playerPoints(p, settings));
    } catch (e) {
      log.warn('season stats unavailable; leaning on the prior', String(e));
    }

    try {
      const recent = await getPlayerStats(leagueKey, keys, 'lastmonth');
      for (const p of recent) recentPts.set(p.playerKey, playerPoints(p, settings));
    } catch (e) {
      log.warn('trailing-month stats unavailable; using season only', String(e));
    }
  } else {
    log.info('no games played yet — valuing entirely from preseason ranks and ownership');
  }

  const ranks = positionalRanks(universe);
  const recentWindow = Math.max(1, Math.min(strategy.valuation.recentWindowGames, Math.max(1, gamesPlayed)));

  const out = new Map<string, Valuation>();
  for (const player of universe) {
    if (out.has(player.playerKey)) continue;

    const prior = baselinePPG({
      player,
      positionalRank: ranks.get(player.playerKey),
      settings,
      strategy,
    });

    const seasonTotal = seasonPts.get(player.playerKey) ?? 0;
    const recentTotal = recentPts.get(player.playerKey);
    const seasonPPG = gamesPlayed > 0 ? perGame(seasonTotal, gamesPlayed) : 0;
    const recentPPG = recentTotal === undefined ? seasonPPG : perGame(recentTotal, recentWindow);

    // Blend production and prior first, then run the result through the normal
    // injury/bye/role adjustments so those apply in preseason too.
    const blendedSeason = blendWithProduction(seasonPPG, prior, gamesPlayed, strategy.valuation.productionRampGames);
    const blendedRecent = blendWithProduction(recentPPG, prior, gamesPlayed, strategy.valuation.productionRampGames);

    const valuation = valuePlayer(
      {
        player,
        seasonPPG: blendedSeason,
        recentPPG: blendedRecent,
        // Shrinkage inside valuePlayer is for small production samples; the
        // prior already handles the cold start, so do not shrink twice.
        gamesPlayed: Math.max(gamesPlayed, 3),
        currentWeek,
      },
      settings,
      strategy,
    );

    if (gamesPlayed === 0) valuation.notes.push(`preseason prior, positional rank ${ranks.get(player.playerKey) ?? '?'}`);
    out.set(player.playerKey, valuation);
  }
  return out;
}
