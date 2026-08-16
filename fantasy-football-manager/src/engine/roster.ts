/**
 * Roster analysis and drop safety.
 *
 * Autonomy makes the drop side the dangerous half of every transaction. A bad
 * add costs a roster spot; a bad drop can leave you unable to field a legal
 * lineup, or hand a rival your best bench stash. Everything here is a guard
 * rail: a player is droppable only if he clears every check.
 */

import type { LeagueSettings, Player, Roster } from '../yahoo/types.js';
import type { StrategyConfig } from '../config.js';
import { hoursHeld } from '../store/state.js';
import { primaryFantasyPosition, isFlexSlot, type Valuation } from './valuation.js';
import { round2 } from './scoring.js';

export interface DropCandidate {
  player: Player;
  valuation: Valuation;
  droppable: boolean;
  /** Why we refuse to drop them, when droppable is false. */
  blockers: string[];
}

export interface RosterAnalysis {
  candidates: DropCandidate[];
  /** Droppable players, worst value first. */
  droppable: DropCandidate[];
  /** True when the roster has an open spot and no drop is needed at all. */
  hasOpenSpot: boolean;
  openSpots: number;
  rosterSize: number;
  maxRosterSize: number;
  positionCounts: Record<string, number>;
}

/** Total roster spots the league allows, including bench (IR is separate). */
export function maxRosterSize(settings: LeagueSettings): number {
  return settings.rosterSlots
    .filter((s) => s.position !== 'IR' && s.position !== 'IR+' && s.position !== 'IL')
    .reduce((a, s) => a + s.count, 0);
}

/** Count roster players by their primary fantasy position. */
export function countByPosition(players: Player[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    if (onIr(p)) continue;
    const pos = primaryFantasyPosition(p);
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}

export function onIr(player: Player): boolean {
  const slot = player.selectedPosition ?? '';
  return slot === 'IR' || slot === 'IR+' || slot === 'IL';
}

export function isStartingThisWeek(player: Player): boolean {
  const slot = player.selectedPosition ?? '';
  return slot !== '' && slot !== 'BN' && !onIr(player);
}

/**
 * Decide whether each rostered player could be dropped right now.
 *
 * Blockers, in the order they tend to matter:
 *   1. Yahoo's own undroppable flag (elite players the platform protects)
 *   2. Your never-drop list
 *   3. Currently in your starting lineup
 *   4. Would break a position floor (leave you unable to fill starters)
 *   5. Anti-churn hold window on a player we just added
 */
export function analyseRoster(opts: {
  roster: Roster;
  valuations: Map<string, Valuation>;
  settings: LeagueSettings;
  strategy: StrategyConfig;
  /** Ignore the min-hold rule, e.g. for a clearly superior upgrade. */
  ignoreHoldWindow?: boolean;
}): RosterAnalysis {
  const { roster, valuations, settings, strategy } = opts;
  const players = roster.players;
  const counts = countByPosition(players);
  const max = maxRosterSize(settings);
  const active = players.filter((p) => !onIr(p));

  const candidates: DropCandidate[] = players.map((player) => {
    const blockers: string[] = [];
    const valuation = valuations.get(player.playerKey) ?? emptyValuation(player);
    const position = valuation.position;

    if (player.isUndroppable) blockers.push('Yahoo marks this player undroppable');

    if (matchesList(player.name, strategy.neverDrop)) blockers.push('on your never-drop list');

    if (isStartingThisWeek(player) && !onIr(player)) {
      blockers.push(`currently starting at ${player.selectedPosition}`);
    }

    const floor = strategy.positionFloors[position];
    if (floor !== undefined && (counts[position] ?? 0) <= floor) {
      blockers.push(`would drop ${position} depth to ${(counts[position] ?? 1) - 1}, below floor of ${floor}`);
    }

    if (!wouldKeepLineupFillable(player, active, settings)) {
      blockers.push('dropping them would leave a starting slot unfillable');
    }

    if (!opts.ignoreHoldWindow) {
      const held = hoursHeld(player.playerKey);
      if (held < strategy.execution.minHoldHours) {
        blockers.push(
          `added ${Math.round(held)}h ago, inside the ${strategy.execution.minHoldHours}h anti-churn window`,
        );
      }
    }

    return { player, valuation, droppable: blockers.length === 0, blockers };
  });

  // Explicit drop-first entries sort to the very front regardless of value.
  const droppable = candidates
    .filter((c) => c.droppable)
    .sort((a, b) => {
      const aFirst = matchesList(a.player.name, strategy.dropFirst) ? 1 : 0;
      const bFirst = matchesList(b.player.name, strategy.dropFirst) ? 1 : 0;
      if (aFirst !== bFirst) return bFirst - aFirst;
      return a.valuation.adjustedValue - b.valuation.adjustedValue;
    });

  return {
    candidates,
    droppable,
    hasOpenSpot: active.length < max,
    openSpots: Math.max(0, max - active.length),
    rosterSize: active.length,
    maxRosterSize: max,
    positionCounts: counts,
  };
}

/**
 * Greedy feasibility check: after removing `dropped`, can every starting slot
 * still be filled by a distinct player?
 *
 * Slots are filled most-constrained-first so a flex spot never steals the only
 * player eligible for a dedicated slot.
 */
export function wouldKeepLineupFillable(
  dropped: Player,
  roster: Player[],
  settings: LeagueSettings,
): boolean {
  const remaining = roster.filter((p) => p.playerKey !== dropped.playerKey && !onIr(p));

  const slots: string[] = [];
  for (const s of settings.startingSlots) {
    for (let i = 0; i < s.count; i++) slots.push(s.position);
  }
  if (!slots.length) return true;

  const eligibleFor = (slot: string, p: Player) => p.eligiblePositions.includes(slot);

  // Fill dedicated slots before flex slots.
  const ordered = [...slots].sort((a, b) => {
    const aFlex = isFlexSlot(a) ? 1 : 0;
    const bFlex = isFlexSlot(b) ? 1 : 0;
    if (aFlex !== bFlex) return aFlex - bFlex;
    const aPool = remaining.filter((p) => eligibleFor(a, p)).length;
    const bPool = remaining.filter((p) => eligibleFor(b, p)).length;
    return aPool - bPool;
  });

  const used = new Set<string>();
  for (const slot of ordered) {
    // Prefer the player with the fewest other options, so we do not burn a
    // versatile player on a slot only he can fill elsewhere.
    const options = remaining
      .filter((p) => !used.has(p.playerKey) && eligibleFor(slot, p))
      .sort((a, b) => a.eligiblePositions.length - b.eligiblePositions.length);
    const pick = options[0];
    if (!pick) return false;
    used.add(pick.playerKey);
  }
  return true;
}

/**
 * The best drop to pair with a given add. Returns undefined when the roster has
 * an open spot (no drop needed) and null-equivalent when nothing is droppable.
 */
export function chooseDropForAdd(
  analysis: RosterAnalysis,
  incoming: Valuation,
  strategy: StrategyConfig,
): { drop?: DropCandidate; valueAdded: number; reason: string } | undefined {
  if (analysis.hasOpenSpot) {
    return {
      valueAdded: incoming.projectedPPG,
      reason: `roster has ${analysis.openSpots} open spot(s); no drop required`,
    };
  }

  const worst = analysis.droppable[0];
  if (!worst) return undefined;

  const valueAdded = round2(incoming.projectedPPG - worst.valuation.projectedPPG);
  return {
    drop: worst,
    valueAdded,
    reason:
      `${incoming.name} (${incoming.projectedPPG} pts/gm) over ` +
      `${worst.player.name} (${worst.valuation.projectedPPG} pts/gm)`,
  };
}

function matchesList(name: string, list: string[]): boolean {
  const lower = name.toLowerCase();
  return list.some((entry) => entry.trim() !== '' && lower.includes(entry.toLowerCase().trim()));
}

function emptyValuation(player: Player): Valuation {
  return {
    playerKey: player.playerKey,
    name: player.name,
    position: primaryFantasyPosition(player),
    projectedPPG: 0,
    adjustedValue: 0,
    basePPG: 0,
    injuryMultiplier: 1,
    roleBonus: 0,
    onBye: false,
    notes: ['no stats available'],
  };
}
