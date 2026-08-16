/**
 * Lineup optimisation.
 *
 * This is the highest-frequency decision in fantasy and the safest one to
 * automate: a lineup change is free, fully reversible, and costs no waiver
 * priority. Leaving a player who has been ruled out in your starting lineup is
 * the single most common way to lose a week, and it is entirely avoidable.
 *
 * Slot assignment is solved exactly rather than greedily — see
 * util/assignment.ts for why flex slots make greedy filling incorrect.
 */

import type { LeagueSettings, Player, Roster } from '../yahoo/types.js';
import type { Valuation } from './valuation.js';
import { maxWeightAssignment } from '../util/assignment.js';
import { onIr } from './roster.js';
import { round2 } from './scoring.js';
import type { LineupSlot } from '../yahoo/write.js';

export interface LineupChange {
  playerKey: string;
  name: string;
  from: string;
  to: string;
  projectedPPG: number;
  reason: string;
}

export interface LineupPlan {
  week: number;
  /** The full optimal assignment, as Yahoo wants it. */
  slots: LineupSlot[];
  /** Only the players whose slot actually changes. */
  changes: LineupChange[];
  projectedPoints: number;
  currentProjectedPoints: number;
  gain: number;
  /** Players we could not move because their game has started. */
  lockedOut: string[];
  notes: string[];
}

export interface OptimiseOptions {
  roster: Roster;
  valuations: Map<string, Valuation>;
  settings: LeagueSettings;
  week: number;
  /**
   * NFL team abbreviations whose game has kicked off. Players on these teams
   * keep their current slot — Yahoo rejects the change anyway, and attempting
   * it fails the whole request.
   */
  lockedTeams?: Set<string>;
}

/**
 * Compute the best legal starting lineup.
 *
 * Players who are Out, on bye or on IR value at zero through the normal
 * valuation path, so they fall to the bench naturally rather than needing a
 * special case.
 */
export function optimiseLineup(opts: OptimiseOptions): LineupPlan {
  const { roster, valuations, settings, week } = opts;
  const locked = opts.lockedTeams ?? new Set<string>();
  const notes: string[] = [];

  // IR-slotted players are not part of the active lineup problem at all.
  const active = roster.players.filter((p) => !onIr(p));

  const slots: string[] = [];
  for (const s of settings.startingSlots) {
    for (let i = 0; i < s.count; i++) slots.push(s.position);
  }

  if (!slots.length) {
    return {
      week, slots: [], changes: [], projectedPoints: 0, currentProjectedPoints: 0,
      gain: 0, lockedOut: [], notes: ['league exposes no starting slots'],
    };
  }

  const ppg = (p: Player) => valuations.get(p.playerKey)?.projectedPPG ?? 0;

  // Locked players are pinned to whatever slot they currently occupy so the
  // optimiser works around them instead of proposing an illegal move.
  const lockedOut: string[] = [];
  const pinned = new Map<number, Player>();
  const available: Player[] = [];

  for (const p of active) {
    if (locked.has(p.team)) {
      lockedOut.push(p.name);
      const slotIndex = findSlotIndex(slots, p.selectedPosition, pinned);
      if (slotIndex >= 0) {
        pinned.set(slotIndex, p);
        continue;
      }
      // Locked on the bench: cannot be started this week.
      continue;
    }
    available.push(p);
  }

  const openSlots = slots.map((_, i) => i).filter((i) => !pinned.has(i));

  // weights[slot][player], -Infinity where the player cannot fill that slot.
  const weights: number[][] = openSlots.map((slotIndex) => {
    const slot = slots[slotIndex]!;
    return available.map((p) => (p.eligiblePositions.includes(slot) ? ppg(p) : Number.NEGATIVE_INFINITY));
  });

  const { rowToColumn } = maxWeightAssignment(weights);

  const assignment = new Map<string, string>();
  const started = new Set<string>();

  for (const [pinnedIndex, player] of pinned) {
    assignment.set(player.playerKey, slots[pinnedIndex]!);
    started.add(player.playerKey);
  }

  rowToColumn.forEach((playerIndex, row) => {
    if (playerIndex < 0) return;
    const slotIndex = openSlots[row]!;
    const player = available[playerIndex]!;
    assignment.set(player.playerKey, slots[slotIndex]!);
    started.add(player.playerKey);
  });

  const unfilled = openSlots.filter((_, row) => rowToColumn[row] === -1);
  if (unfilled.length) {
    notes.push(`${unfilled.length} starting slot(s) could not be filled: ${unfilled.map((i) => slots[i]).join(', ')}`);
  }

  // Everyone not starting sits.
  for (const p of active) {
    if (!started.has(p.playerKey)) assignment.set(p.playerKey, 'BN');
  }

  const changes: LineupChange[] = [];
  for (const p of active) {
    const to = assignment.get(p.playerKey) ?? 'BN';
    const from = p.selectedPosition ?? 'BN';
    if (from === to) continue;
    changes.push({
      playerKey: p.playerKey,
      name: p.name,
      from,
      to,
      projectedPPG: ppg(p),
      reason: describeChange(p, from, to, valuations.get(p.playerKey)),
    });
  }

  const projectedPoints = round2(
    active.filter((p) => (assignment.get(p.playerKey) ?? 'BN') !== 'BN').reduce((a, p) => a + ppg(p), 0),
  );
  const currentProjectedPoints = round2(
    active.filter((p) => isStartingSlot(p.selectedPosition)).reduce((a, p) => a + ppg(p), 0),
  );

  return {
    week,
    slots: [...assignment].map(([playerKey, position]) => ({ playerKey, position })),
    changes,
    projectedPoints,
    currentProjectedPoints,
    gain: round2(projectedPoints - currentProjectedPoints),
    lockedOut,
    notes,
  };
}

/**
 * Only the players who actually need moving. Yahoo accepts a partial roster
 * update, so sending the whole lineup every time is noise that risks touching
 * players we did not mean to.
 */
export function changedSlotsOnly(plan: LineupPlan): LineupSlot[] {
  return plan.changes.map((c) => ({ playerKey: c.playerKey, position: c.to }));
}

function isStartingSlot(slot: string | undefined): boolean {
  return !!slot && slot !== 'BN' && slot !== 'IR' && slot !== 'IR+' && slot !== 'IL';
}

function findSlotIndex(slots: string[], position: string | undefined, taken: Map<number, Player>): number {
  if (!isStartingSlot(position)) return -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === position && !taken.has(i)) return i;
  }
  return -1;
}

function describeChange(player: Player, from: string, to: string, valuation: Valuation | undefined): string {
  const status = player.status?.toUpperCase() ?? '';
  if (to === 'BN') {
    if (status === 'O' || status === 'IR' || status === 'PUP' || status === 'SUSP') {
      return `benched: ruled ${player.statusFull ?? status}`;
    }
    if (valuation?.onBye) return `benched: on bye week ${player.byeWeek}`;
    if (status === 'D') return `benched: doubtful`;
    return `benched: a higher-projected player takes the ${from} slot`;
  }
  if (from === 'BN') return `started at ${to} (${valuation?.projectedPPG ?? 0} pts/gm)`;
  return `moved ${from} → ${to} to free up the slot for a better fit`;
}

/**
 * Teams whose game has already kicked off, derived from ESPN's scoreboard.
 * Players on these teams are locked and must not be moved.
 */
export function lockedTeamsFromGames(
  games: { state: string; competitors: { team: string }[] }[],
): Set<string> {
  const locked = new Set<string>();
  for (const g of games) {
    if (g.state === 'in' || g.state === 'post') {
      for (const c of g.competitors) if (c.team) locked.add(c.team);
    }
  }
  return locked;
}
