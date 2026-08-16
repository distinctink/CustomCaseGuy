/**
 * Cold-start valuation.
 *
 * The production-based model in valuation.ts is worthless before games are
 * played: in preseason and week 1 every player scores 0, every pickup looks
 * like a 0-point upgrade, and the engine sits inert exactly when the wire is
 * most volatile.
 *
 * This module supplies the missing prior. Yahoo already tells us each player's
 * overall rank and rostered percentage; from those we derive a positional rank
 * and read an expected points-per-game off a curve, then hand off to real
 * production as games accumulate.
 *
 * The curves are anchored to typical full-PPR output and adapted to the
 * league's actual scoring, so a standard-scoring league does not inherit
 * PPR receiver numbers.
 */

import type { LeagueSettings, Player } from '../yahoo/types.js';
import type { StrategyConfig } from '../config.js';
import { primaryFantasyPosition } from './valuation.js';
import { round2 } from './scoring.js';

/**
 * Points per game by positional rank, in a full-PPR league with 4-point
 * passing touchdowns. Piecewise linear between anchors, flat beyond the last.
 *
 * These are deliberately conservative at the top: overpaying for a rank-1
 * projection is how a bot talks itself into burning waiver priority in week 1.
 */
const CURVES: Record<string, [rank: number, ppg: number][]> = {
  QB: [[1, 21], [4, 19], [8, 17.5], [12, 16], [18, 14], [24, 12], [32, 9]],
  RB: [[1, 19], [4, 16], [8, 14], [12, 12.5], [18, 10.5], [24, 9], [36, 7], [48, 5], [60, 3.5]],
  WR: [[1, 18], [4, 15.5], [8, 14], [12, 12.5], [18, 11], [24, 9.5], [36, 7.5], [48, 6], [60, 4.5]],
  TE: [[1, 14], [3, 11], [6, 9.5], [10, 8], [14, 6.5], [20, 5], [30, 3.5]],
  K: [[1, 9.5], [6, 8.5], [12, 8], [20, 7], [32, 6]],
  DEF: [[1, 9.5], [4, 8.5], [8, 7.5], [12, 6.5], [20, 5.5], [32, 4.5]],
};

/** Typical receptions per game, used to adapt the curves away from full PPR. */
const RECEPTIONS_PER_GAME: Record<string, number> = { WR: 4.8, RB: 2.8, TE: 4.0, QB: 0, K: 0, DEF: 0 };

/** Typical passing touchdowns per game, for leagues that do not use 4 points. */
const PASS_TD_PER_GAME: Record<string, number> = { QB: 1.6, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };

/** Yahoo stat ids. 11 = receptions, 5 = passing touchdowns. */
const STAT_RECEPTIONS = 11;
const STAT_PASS_TD = 5;

/**
 * Read expected points per game off the curve for a positional rank.
 * Ranks below 1 are clamped; ranks past the last anchor hold flat.
 */
export function curveValue(position: string, positionalRank: number): number {
  const curve = CURVES[position];
  if (!curve || !curve.length) return 0;
  const rank = Math.max(1, positionalRank);

  const first = curve[0]!;
  if (rank <= first[0]) return first[1];
  const last = curve[curve.length - 1]!;
  if (rank >= last[0]) return last[1];

  for (let i = 1; i < curve.length; i++) {
    const [r1, p1] = curve[i]!;
    const [r0, p0] = curve[i - 1]!;
    if (rank <= r1) {
      const t = (rank - r0) / (r1 - r0);
      return p0 + t * (p1 - p0);
    }
  }
  return last[1];
}

/**
 * Adjust a full-PPR curve value for this league's actual scoring.
 *
 * Only the two settings that move the needle materially are modelled:
 * reception points (which swing receiver and back values by several points a
 * game) and passing-touchdown points (4 vs 6 is worth ~3 ppg to a starting QB).
 */
export function adaptToScoring(position: string, pprValue: number, settings: LeagueSettings): number {
  const receptionPoints = settings.statModifiers.get(STAT_RECEPTIONS) ?? 0;
  const passTdPoints = settings.statModifiers.get(STAT_PASS_TD) ?? 4;

  const recAdjust = (receptionPoints - 1) * (RECEPTIONS_PER_GAME[position] ?? 0);
  const tdAdjust = (passTdPoints - 4) * (PASS_TD_PER_GAME[position] ?? 0);

  return Math.max(0, pprValue + recAdjust + tdAdjust);
}

/**
 * Best available overall rank for a player. Prefers the in-season rank when
 * Yahoo has one, since it reflects actual results, and falls back to the
 * preseason rank before games are played.
 */
export function overallRank(player: Player): number | undefined {
  const preferred = ['AR', 'PR', 'OR', 'PS', 'SR'];
  for (const type of preferred) {
    const hit = player.ranks.find((r) => r.rankType === type && Number.isFinite(r.rankValue));
    if (hit) return hit.rankValue;
  }
  const any = player.ranks.find((r) => Number.isFinite(r.rankValue));
  return any?.rankValue;
}

/**
 * Convert overall ranks into positional ranks across a player universe.
 *
 * Yahoo publishes overall ranks only, but value is positional: the 40th-best
 * player overall might be WR18 or RB9, and those are worth very different
 * amounts. Ranking within position across the whole universe recovers that.
 *
 * `universe` must span everyone relevant — every rostered player plus the
 * available pool — or a free agent will look far better than he is simply
 * because the good players at his position are on other teams.
 */
export function positionalRanks(universe: Player[]): Map<string, number> {
  const byPosition = new Map<string, { key: string; rank: number; owned: number }[]>();

  for (const p of universe) {
    const position = primaryFantasyPosition(p);
    if (!CURVES[position]) continue;
    const rank = overallRank(p);
    const list = byPosition.get(position) ?? [];
    list.push({
      key: p.playerKey,
      // Players with no rank at all sort to the back, ordered by ownership.
      rank: rank ?? Number.MAX_SAFE_INTEGER,
      owned: p.percentOwned ?? 0,
    });
    byPosition.set(position, list);
  }

  const out = new Map<string, number>();
  for (const list of byPosition.values()) {
    list.sort((a, b) => (a.rank - b.rank) || (b.owned - a.owned));
    list.forEach((entry, i) => out.set(entry.key, i + 1));
  }
  return out;
}

export interface BaselineInput {
  player: Player;
  positionalRank: number | undefined;
  settings: LeagueSettings;
  strategy: StrategyConfig;
}

/**
 * Prior expectation of points per game, before any production is known.
 *
 * Rostered percentage is folded in as a correction rather than a driver: it is
 * a crowd signal about role and opportunity that ranks alone miss, but it lags
 * badly on genuinely new situations, so it only nudges.
 */
export function baselinePPG(input: BaselineInput): number {
  const { player, positionalRank, settings, strategy } = input;
  const position = primaryFantasyPosition(player);
  if (!CURVES[position]) return 0;

  // With no rank at all, treat the player as replacement level rather than
  // guessing — an unranked player is almost always a deep bench body.
  const rank = positionalRank ?? lastAnchorRank(position);
  const raw = curveValue(position, rank);
  const scored = adaptToScoring(position, raw, settings);

  const weight = strategy.valuation.ownershipWeight;
  if (weight <= 0 || player.percentOwned === undefined) return round2(scored);

  // Map rostered% onto the same curve: a player owned in 80% of leagues is
  // treated as roughly a starter at his position.
  const impliedRank = ownershipToRank(position, player.percentOwned);
  const impliedValue = adaptToScoring(position, curveValue(position, impliedRank), settings);

  return round2(scored * (1 - weight) + impliedValue * weight);
}

function lastAnchorRank(position: string): number {
  const curve = CURVES[position];
  return curve?.[curve.length - 1]?.[0] ?? 60;
}

/**
 * Rostered percentage -> an equivalent positional rank. 100% owned maps to the
 * top of the curve, 0% to the bottom, scaled by how many players at that
 * position are startable in a typical league.
 */
function ownershipToRank(position: string, percentOwned: number): number {
  const depth = lastAnchorRank(position);
  const pct = Math.max(0, Math.min(100, percentOwned));
  return Math.max(1, Math.round(depth - (pct / 100) * (depth - 1)));
}

/**
 * How much to trust production over the prior.
 *
 * Ramps from 0 (no games, use the prior alone) to 1 (enough games that the
 * production number stands on its own).
 */
export function productionConfidence(gamesPlayed: number, rampGames: number): number {
  if (rampGames <= 0) return 1;
  return Math.max(0, Math.min(1, gamesPlayed / rampGames));
}

/**
 * Blend the prior with observed production.
 *
 * This is the whole point of the module: in week 1 the answer is the prior, by
 * week 5 it is essentially production, and in between it slides smoothly
 * instead of flipping.
 */
export function blendWithProduction(
  productionPPG: number,
  priorPPG: number,
  gamesPlayed: number,
  rampGames: number,
): number {
  const confidence = productionConfidence(gamesPlayed, rampGames);
  return round2(productionPPG * confidence + priorPPG * (1 - confidence));
}
