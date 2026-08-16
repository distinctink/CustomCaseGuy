/**
 * League scoring.
 *
 * We never hardcode a scoring system. Yahoo hands us `stat_modifiers`
 * (stat_id -> points per unit) in the league settings and `player_stats`
 * (stat_id -> value) on players, so fantasy points are just the dot product.
 * That makes this correct for PPR, half-PPR, 6-point passing TDs, return
 * yardage, bonus categories — whatever your commissioner set up.
 */

import type { LeagueSettings, Player } from '../yahoo/types.js';

/** Fantasy points for a stat line under this league's rules. */
export function scoreStats(stats: Map<number, number>, settings: LeagueSettings): number {
  let total = 0;
  for (const [statId, value] of stats) {
    const modifier = settings.statModifiers.get(statId);
    if (modifier === undefined || !Number.isFinite(value)) continue;
    total += value * modifier;
  }
  return round2(total);
}

/**
 * Points for a player. Yahoo's own `player_points.total` is authoritative when
 * present (it accounts for bonuses we might not model), so prefer it and fall
 * back to computing from the raw stat line.
 */
export function playerPoints(player: Player, settings: LeagueSettings): number {
  if (typeof player.points === 'number' && Number.isFinite(player.points)) return player.points;
  if (player.stats) return scoreStats(player.stats, settings);
  return 0;
}

/**
 * Human-readable breakdown of where a player's points came from. Used in
 * decision explanations so a move is auditable after the fact.
 */
export function explainScore(
  stats: Map<number, number>,
  settings: LeagueSettings,
): { category: string; value: number; points: number }[] {
  const byId = new Map(settings.statCategories.map((c) => [c.statId, c]));
  const rows: { category: string; value: number; points: number }[] = [];

  for (const [statId, value] of stats) {
    const modifier = settings.statModifiers.get(statId);
    if (modifier === undefined || value === 0) continue;
    rows.push({
      category: byId.get(statId)?.displayName ?? byId.get(statId)?.name ?? `stat ${statId}`,
      value,
      points: round2(value * modifier),
    });
  }
  return rows.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

/** True if this league gives a point (or fraction) per reception. */
export function receptionPoints(settings: LeagueSettings): number {
  return settings.statModifiers.get(11) ?? 0;
}

/** Which roster slots a player can legally fill, given the league's slots. */
export function eligibleSlots(player: Player, settings: LeagueSettings): string[] {
  const eligible = new Set(player.eligiblePositions);
  return settings.startingSlots.map((s) => s.position).filter((slot) => eligible.has(slot));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
