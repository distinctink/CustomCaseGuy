/**
 * Player valuation.
 *
 * The output is a projected points-per-game number in *this league's* scoring,
 * plus a comparison-weighted value that accounts for positional scarcity.
 *
 * Everything upstream is free data: Yahoo gives season and trailing-month
 * production and rostered-percentage; ESPN supplies the injury designation and
 * the role-change signal. There is no paid projection feed involved, so the
 * model leans on recent usage and role rather than pretending to forecast.
 */

import type { LeagueSettings, Player } from '../yahoo/types.js';
import type { StrategyConfig } from '../config.js';
import { round2 } from './scoring.js';

export interface ValuationInput {
  player: Player;
  /** Points per game across the full season so far. */
  seasonPPG: number;
  /** Points per game across the recent window (trailing month by default). */
  recentPPG: number;
  /** Games the player has actually played; low counts get shrunk to the mean. */
  gamesPlayed?: number;
  /** Injury designation to apply, defaulting to the player's Yahoo status. */
  injuryStatus?: string;
  /** Set when a news event implies a role change (see strategy.roleChangeBonus). */
  roleChange?: string;
  /** Current fantasy week, used for the bye check. */
  currentWeek?: number;
}

export interface Valuation {
  playerKey: string;
  name: string;
  position: string;
  /** Blended, injury- and bye-adjusted points per game. */
  projectedPPG: number;
  /** projectedPPG scaled by positional scarcity, for cross-position comparison. */
  adjustedValue: number;
  /** Raw blend before adjustments, useful in explanations. */
  basePPG: number;
  injuryMultiplier: number;
  roleBonus: number;
  onBye: boolean;
  notes: string[];
}

/**
 * Small-sample shrinkage: a player with two games of data should not outrank a
 * proven starter on the strength of one spike. Pulls the estimate toward the
 * season number until enough games accumulate.
 */
const SHRINK_GAMES = 3;

export function valuePlayer(input: ValuationInput, settings: LeagueSettings, strategy: StrategyConfig): Valuation {
  const { player } = input;
  const v = strategy.valuation;
  const notes: string[] = [];

  // Weights are normalised so a partially-specified config cannot silently
  // scale every value up or down.
  const wSum = v.seasonWeight + v.recentWeight || 1;
  const seasonW = v.seasonWeight / wSum;
  const recentW = v.recentWeight / wSum;

  let basePPG = input.seasonPPG * seasonW + input.recentPPG * recentW;

  const games = input.gamesPlayed ?? 0;
  if (games > 0 && games < SHRINK_GAMES) {
    const factor = games / SHRINK_GAMES;
    const shrunk = basePPG * factor + input.seasonPPG * (1 - factor);
    notes.push(`shrunk for ${games}-game sample`);
    basePPG = shrunk;
  }

  const status = (input.injuryStatus ?? player.status ?? '').toUpperCase();
  const injuryMultiplier = status ? (v.injuryMultiplier[status] ?? 1) : 1;
  if (injuryMultiplier !== 1) notes.push(`injury ${status || 'none'} x${injuryMultiplier}`);

  const roleBonus = input.roleChange ? (v.roleChangeBonus[input.roleChange] ?? 0) : 0;
  if (roleBonus) notes.push(`role change ${input.roleChange} +${roleBonus}`);

  const onBye = input.currentWeek !== undefined && player.byeWeek === input.currentWeek;
  const byeFactor = onBye ? v.byeWeekDiscount : 1;
  if (onBye) notes.push(`on bye week ${player.byeWeek}`);

  // The role bonus is an expectation about future usage, so it is not scaled
  // down by the current week's bye — but it is scaled by availability.
  const projectedPPG = round2(Math.max(0, basePPG * injuryMultiplier * byeFactor + roleBonus * injuryMultiplier));

  const position = primaryFantasyPosition(player);
  const scarcity = strategy.positionPriority[position] ?? 1;

  return {
    playerKey: player.playerKey,
    name: player.name,
    position,
    projectedPPG,
    adjustedValue: round2(projectedPPG * scarcity),
    basePPG: round2(basePPG),
    injuryMultiplier,
    roleBonus,
    onBye,
    notes,
  };
}

/** The position we treat a player as, for scarcity and floor purposes. */
export function primaryFantasyPosition(player: Player): string {
  const candidates = player.eligiblePositions.filter((p) => !isFlexSlot(p) && p !== 'BN' && p !== 'IR');
  const primary = player.primaryPosition || player.displayPosition.split(',')[0] || '';
  if (primary && candidates.includes(primary)) return primary;
  return candidates[0] ?? primary ?? 'UNKNOWN';
}

export function isFlexSlot(position: string): boolean {
  return position.includes('/') || position === 'FLEX' || position === 'W/R' || position === 'Q/W/R/T';
}

/**
 * Replacement level: what you could get off the wire for free at a position.
 * Value added by a pickup is measured against the player you would drop, but
 * replacement level tells you whether a position is genuinely scarce or you are
 * about to spend a claim on a player the pool would have handed you anyway.
 */
export function replacementLevel(valuations: Valuation[], position: string, depth = 3): number {
  const atPosition = valuations
    .filter((v) => v.position === position)
    .sort((a, b) => b.projectedPPG - a.projectedPPG);
  if (!atPosition.length) return 0;
  const idx = Math.min(depth, atPosition.length) - 1;
  return atPosition[idx]!.projectedPPG;
}

/**
 * Derive per-game numbers from Yahoo stat pulls.
 *
 * `average_season` and `average_lastmonth` already come back per-game, so when
 * those are available we use them directly; otherwise we divide a total by the
 * games we believe were played.
 */
export function perGame(totalPoints: number, games: number): number {
  if (!Number.isFinite(totalPoints) || games <= 0) return 0;
  return round2(totalPoints / games);
}
