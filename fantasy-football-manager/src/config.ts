/**
 * Environment + strategy configuration.
 *
 * Env holds secrets and wiring. Strategy holds every number the decision engine
 * uses, in a JSON file you can edit without touching code.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: resolve(ROOT, '.env'), quiet: true });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get yahooClientId() { return req('YAHOO_CLIENT_ID'); },
  get yahooClientSecret() { return req('YAHOO_CLIENT_SECRET'); },
  get yahooRedirectUri() { return opt('YAHOO_REDIRECT_URI', 'https://localhost:8765/callback'); },
  get tokenPath() { return resolve(ROOT, opt('TOKEN_PATH', 'data/yahoo-tokens.json')); },
  get statePath() { return resolve(ROOT, opt('STATE_PATH', 'data/state.json')); },
  get strategyPath() { return resolve(ROOT, opt('STRATEGY_PATH', 'config/strategy.json')); },
  /** Optional: pin a league so you do not have to pass it every time. */
  get leagueKey() { return process.env.YAHOO_LEAGUE_KEY || undefined; },
  get gameKey() { return opt('YAHOO_GAME_KEY', 'nfl'); },
  /** Where trade alerts and other human-in-the-loop notices go. */
  get notifyWebhook() { return process.env.NOTIFY_WEBHOOK_URL || undefined; },
  get dryRun() { return /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? ''); },
};

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

export interface StrategyConfig {
  /** Players you will never drop, by name substring (case-insensitive). */
  neverDrop: string[];
  /** Players you are happy to drop first, regardless of value. */
  dropFirst: string[];
  /**
   * Minimum bench players to keep at each position after any transaction.
   * Guards against dropping yourself into an unfillable starting lineup.
   */
  positionFloors: Record<string, number>;
  /** Relative weight of each position when comparing pickups. */
  positionPriority: Record<string, number>;

  valuation: {
    /** Weight on season-long points per game vs. recent form. Must sum to 1. */
    seasonWeight: number;
    recentWeight: number;
    /** Games in the "recent form" window. */
    recentWindowGames: number;
    /**
     * How much the cold-start prior leans on rostered-% versus Yahoo's ranks.
     * 0 = ranks only. Only affects valuation before real production exists.
     */
    ownershipWeight: number;
    /**
     * Games of production needed before we stop leaning on the preseason prior.
     * Until then, valuation blends the two — without this the engine is inert
     * in week 1 because nobody has scored anything yet.
     */
    productionRampGames: number;
    /** Points added by an expected role change (e.g. promoted to RB1). */
    roleChangeBonus: Record<string, number>;
    /** Multiplier applied to a player whose team is on bye this week. */
    byeWeekDiscount: number;
    /** Multiplier by injury designation. */
    injuryMultiplier: Record<string, number>;
  };

  waiver: {
    /**
     * Minimum projected points-per-game gained over the player we would drop
     * before we will spend a waiver claim at all.
     */
    minValueAdded: number;
    /**
     * Value of holding waiver priority #1, expressed in the same
     * points-per-game units, at the start of the season. Scales down as the
     * season runs out (fewer future chances to use it).
     */
    priorityOneValue: number;
    /** Each step down in priority is worth this fraction of the step above. */
    priorityDecay: number;
    /** Total weeks in the fantasy regular season, for option-value decay. */
    regularSeasonWeeks: number;
    /**
     * If estimated probability that a rival claims the player is below this,
     * skip the claim and take them as a free agent after waivers clear.
     */
    contestThreshold: number;
    /** Number of rival managers treated as genuinely active. */
    activeRivals: number;
    /** A rival counts as active if they made a move in this many days. */
    activeRivalLookbackDays: number;
    /**
     * How reluctant we assume rivals are to spend their own priority.
     * Higher = rivals modelled as more passive = we claim less often and let
     * more players clear to free agency. Raise it if the bot is burning
     * priority on players nobody else wanted; lower it if you keep getting
     * sniped on waivers.
     */
    rivalPassivity: number;
  };

  execution: {
    /** Hard cap on autonomous adds/drops per rolling 24h. */
    maxTransactionsPerDay: number;
    /** Do not drop a player added within this many days (anti-churn). */
    minHoldHours: number;
    /** Never act on a player whose news item is older than this. */
    maxNewsAgeMinutes: number;
    /** Poll cadence for the ESPN watcher. */
    pollIntervalSeconds: number;
    /** Refresh the Yahoo free-agent pool at most this often. */
    faRefreshSeconds: number;
    /** Trades are alert-only. Kept explicit so it cannot be flipped by accident. */
    autoExecuteTrades: false;
    /**
     * Set the starting lineup autonomously. Safe to leave on: lineup changes
     * cost nothing, are fully reversible, and spend no waiver priority.
     */
    autoSetLineup: boolean;
    /** Only rewrite the lineup when it gains at least this many points. */
    minLineupGain: number;
    /** Hour of the local day Yahoo processes waivers, for clear-time maths. */
    waiverProcessingHour: number;
    /** Poll this often when a watchlist player is about to clear waivers. */
    sprintIntervalSeconds: number;
    /** How far ahead of a clear time to start sprint polling. */
    sprintWindowMinutes: number;
    /** Give up chasing a cleared player after this many attempts. */
    maxWatchlistAttempts: number;
    /** Drop watchlist entries older than this. */
    watchlistTtlHours: number;
    /** Generate trade ideas (still alert-only) during routine sweeps. */
    suggestTrades: boolean;
  };
}

export const DEFAULT_STRATEGY: StrategyConfig = {
  neverDrop: [],
  dropFirst: [],
  positionFloors: { QB: 1, RB: 4, WR: 4, TE: 1, K: 1, DEF: 1 },
  positionPriority: { RB: 1.15, WR: 1.05, TE: 1.0, QB: 0.85, K: 0.4, DEF: 0.5 },
  valuation: {
    seasonWeight: 0.4,
    recentWeight: 0.6,
    recentWindowGames: 4,
    ownershipWeight: 0.15,
    productionRampGames: 4,
    roleChangeBonus: {
      // Points-per-game added when news implies this role change.
      starter_out_backup_promoted: 6.0,
      committee_to_bellcow: 4.5,
      wr2_to_wr1: 3.0,
      te_starter_out: 2.5,
      qb_starter_change: 5.0,
      returning_from_injury: 2.0,
    },
    byeWeekDiscount: 0.0,
    injuryMultiplier: {
      HEALTHY: 1.0,
      PROBABLE: 0.95,
      Q: 0.8,
      QUESTIONABLE: 0.8,
      D: 0.45,
      DOUBTFUL: 0.45,
      O: 0.0,
      OUT: 0.0,
      IR: 0.0,
      PUP: 0.0,
      NA: 0.0,
      SUSP: 0.0,
    },
  },
  waiver: {
    minValueAdded: 1.5,
    priorityOneValue: 3.0,
    priorityDecay: 0.82,
    regularSeasonWeeks: 14,
    contestThreshold: 0.35,
    activeRivals: 3,
    activeRivalLookbackDays: 14,
    // Tuned for "12 teams, only a couple genuinely active": a rival spends
    // priority on a threshold-level player roughly a fifth of the time.
    rivalPassivity: 1.4,
  },
  execution: {
    maxTransactionsPerDay: 4,
    minHoldHours: 48,
    maxNewsAgeMinutes: 180,
    pollIntervalSeconds: 90,
    faRefreshSeconds: 600,
    autoExecuteTrades: false,
    autoSetLineup: true,
    minLineupGain: 0.5,
    waiverProcessingHour: 3,
    sprintIntervalSeconds: 15,
    sprintWindowMinutes: 10,
    maxWatchlistAttempts: 20,
    watchlistTtlHours: 96,
    suggestTrades: true,
  },
};

let cached: StrategyConfig | undefined;

export function loadStrategy(path = env.strategyPath): StrategyConfig {
  if (cached) return cached;
  if (!existsSync(path)) {
    cached = DEFAULT_STRATEGY;
    return cached;
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<StrategyConfig>;
  cached = mergeStrategy(DEFAULT_STRATEGY, raw);
  // autoExecuteTrades is a locked decision; refuse to honour a truthy override.
  if ((raw.execution as { autoExecuteTrades?: unknown } | undefined)?.autoExecuteTrades) {
    throw new Error(
      'strategy.json sets execution.autoExecuteTrades=true. Trades are alert-only by design; remove that key.',
    );
  }
  cached.execution.autoExecuteTrades = false;
  return cached;
}

/** Deep-merge one level into nested record fields, so partial configs work. */
function mergeStrategy(base: StrategyConfig, over: Partial<StrategyConfig>): StrategyConfig {
  return {
    neverDrop: over.neverDrop ?? base.neverDrop,
    dropFirst: over.dropFirst ?? base.dropFirst,
    positionFloors: { ...base.positionFloors, ...over.positionFloors },
    positionPriority: { ...base.positionPriority, ...over.positionPriority },
    valuation: {
      ...base.valuation,
      ...over.valuation,
      roleChangeBonus: { ...base.valuation.roleChangeBonus, ...over.valuation?.roleChangeBonus },
      injuryMultiplier: { ...base.valuation.injuryMultiplier, ...over.valuation?.injuryMultiplier },
    },
    waiver: { ...base.waiver, ...over.waiver },
    execution: { ...base.execution, ...over.execution, autoExecuteTrades: false },
  };
}

export function resetStrategyCache(): void {
  cached = undefined;
}
