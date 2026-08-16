/**
 * Trade idea generation.
 *
 * Nothing here executes anything. It finds swaps where both sides plausibly
 * improve, and hands them to the human approval gate. A proposal the other
 * manager would obviously reject is worse than no proposal — it burns
 * credibility in a league you have to keep playing in — so a candidate only
 * survives if it helps them too, judged by the same valuation model.
 *
 * The core idea is positional surplus: starting lineups have fixed shapes, so
 * a fourth good running back is worth far less to you than to a manager
 * starting a replacement-level one.
 */

import type { LeagueSettings, Player, Roster, Team } from '../yahoo/types.js';
import type { StrategyConfig } from '../config.js';
import type { Valuation } from './valuation.js';
import { primaryFantasyPosition } from './valuation.js';
import { round2 } from './scoring.js';

export interface PositionStrength {
  position: string;
  /** Value of the players who would actually start, best first. */
  starters: number[];
  /** Value of everyone beyond the starting requirement. */
  depth: number[];
  /** Starting slots this league requires at this position. */
  required: number;
  /** Positive = surplus beyond what the lineup needs. */
  surplus: number;
  /** Value of the weakest player forced into a starting slot. */
  weakestStarter: number;
}

export interface TeamProfile {
  teamKey: string;
  name: string;
  strengths: Map<string, PositionStrength>;
  players: Player[];
}

export interface TradeIdea {
  theirTeamKey: string;
  theirTeamName: string;
  send: { playerKey: string; name: string; position: string; value: number }[];
  receive: { playerKey: string; name: string; position: string; value: number }[];
  /** Points per game this adds to my starting lineup. */
  myGain: number;
  /** Points per game it adds to theirs, by the same model. */
  theirGain: number;
  /** Rough odds they accept, from how lopsided the gains are. */
  acceptability: number;
  rationale: string;
}

/**
 * How many starting slots a position effectively requires, counting flex.
 *
 * Flex slots are shared, so they are spread across the positions eligible for
 * them rather than counted for each — otherwise every position looks scarcer
 * than it is.
 */
export function requiredStarters(settings: LeagueSettings): Map<string, number> {
  const required = new Map<string, number>();
  const flexEligible = ['RB', 'WR', 'TE'];

  for (const slot of settings.startingSlots) {
    const position = slot.position;
    if (position.includes('/') || position === 'FLEX') {
      const share = slot.count / flexEligible.length;
      for (const p of flexEligible) required.set(p, (required.get(p) ?? 0) + share);
      continue;
    }
    required.set(position, (required.get(position) ?? 0) + slot.count);
  }
  return required;
}

export function profileTeam(
  team: Team,
  roster: Roster,
  valuations: Map<string, Valuation>,
  settings: LeagueSettings,
): TeamProfile {
  const required = requiredStarters(settings);
  const byPosition = new Map<string, Player[]>();

  for (const p of roster.players) {
    const position = primaryFantasyPosition(p);
    const list = byPosition.get(position) ?? [];
    list.push(p);
    byPosition.set(position, list);
  }

  const strengths = new Map<string, PositionStrength>();
  for (const [position, players] of byPosition) {
    const values = players
      .map((p) => valuations.get(p.playerKey)?.projectedPPG ?? 0)
      .sort((a, b) => b - a);
    const need = Math.round(required.get(position) ?? 0);
    const starters = values.slice(0, Math.max(need, 0));
    const depth = values.slice(Math.max(need, 0));

    strengths.set(position, {
      position,
      starters,
      depth,
      required: need,
      surplus: values.length - need,
      weakestStarter: starters.length ? starters[starters.length - 1]! : 0,
    });
  }

  return { teamKey: team.teamKey, name: team.name, strengths, players: roster.players };
}

/**
 * Marginal value of adding a player to a team: how much he improves the
 * *starting lineup*, not the roster. A player who would not crack the lineup
 * adds almost nothing, which is exactly why surplus depth is tradeable.
 */
export function marginalValue(profile: TeamProfile, position: string, value: number): number {
  const strength = profile.strengths.get(position);
  if (!strength || strength.required <= 0) return 0;
  if (strength.starters.length < strength.required) return value;
  const displaced = strength.weakestStarter;
  return Math.max(0, value - displaced);
}

/** Value lost by giving a player up. */
export function lossValue(profile: TeamProfile, position: string, value: number): number {
  const strength = profile.strengths.get(position);
  if (!strength) return value;
  if (!strength.starters.includes(value)) {
    // Bench player: losing him only costs the gap to the next man up.
    const replacement = strength.depth.find((v) => v !== value) ?? 0;
    return Math.max(0, value - replacement);
  }
  const replacement = strength.depth[0] ?? 0;
  return Math.max(0, value - replacement);
}

/**
 * Generate one-for-one swaps that improve both starting lineups.
 *
 * Restricted to 1-for-1 deliberately: multi-player packages are far harder for
 * a human to evaluate quickly, they are much more likely to be rejected out of
 * hand, and the surplus-for-need logic that makes a trade work is clearest in
 * its simplest form.
 */
export function generateTradeIdeas(opts: {
  me: TeamProfile;
  rivals: TeamProfile[];
  valuations: Map<string, Valuation>;
  strategy: StrategyConfig;
  /** Do not propose sending these players. */
  untouchable?: (player: Player) => boolean;
  maxIdeas?: number;
  /** Minimum points per game the deal must add to my lineup. */
  minGain?: number;
}): TradeIdea[] {
  const { me, rivals, valuations, strategy } = opts;
  const minGain = opts.minGain ?? strategy.waiver.minValueAdded;
  const ideas: TradeIdea[] = [];

  const valueOf = (p: Player) => valuations.get(p.playerKey)?.projectedPPG ?? 0;

  for (const rival of rivals) {
    for (const mine of me.players) {
      if (opts.untouchable?.(mine)) continue;
      const myPos = primaryFantasyPosition(mine);
      const myValue = valueOf(mine);
      if (myValue <= 0) continue;

      for (const theirs of rival.players) {
        const theirPos = primaryFantasyPosition(theirs);
        const theirValue = valueOf(theirs);
        if (theirValue <= 0) continue;

        // A swap within the same position rarely helps either side.
        if (myPos === theirPos) continue;

        const myGain = round2(
          marginalValue(me, theirPos, theirValue) - lossValue(me, myPos, myValue),
        );
        const theirGain = round2(
          marginalValue(rival, myPos, myValue) - lossValue(rival, theirPos, theirValue),
        );

        if (myGain < minGain) continue;
        // They have to want it too, or proposing is just noise.
        if (theirGain <= 0) continue;

        ideas.push({
          theirTeamKey: rival.teamKey,
          theirTeamName: rival.name,
          send: [{ playerKey: mine.playerKey, name: mine.name, position: myPos, value: myValue }],
          receive: [{ playerKey: theirs.playerKey, name: theirs.name, position: theirPos, value: theirValue }],
          myGain,
          theirGain,
          acceptability: acceptability(myGain, theirGain),
          rationale:
            `I have ${describeSurplus(me, myPos)} at ${myPos} and ${describeNeed(me, theirPos)} at ${theirPos}; ` +
            `${rival.name} is the mirror image. ` +
            `Sending ${mine.name} (${myValue} pts/gm) for ${theirs.name} (${theirValue} pts/gm) ` +
            `adds ${myGain} pts/gm to my starting lineup and ${theirGain} to theirs.`,
        });
      }
    }
  }

  // Prefer deals that are good for me but still clearly attractive to them.
  ideas.sort((a, b) => b.myGain * b.acceptability - a.myGain * a.acceptability);

  const seen = new Set<string>();
  const unique: TradeIdea[] = [];
  for (const idea of ideas) {
    // One idea per rival keeps the alert digestible.
    if (seen.has(idea.theirTeamKey)) continue;
    seen.add(idea.theirTeamKey);
    unique.push(idea);
    if (unique.length >= (opts.maxIdeas ?? 3)) break;
  }
  return unique;
}

/**
 * Rough probability the other manager accepts. Deals that are wildly better
 * for me look predatory and get ignored, so lopsidedness is penalised.
 */
function acceptability(myGain: number, theirGain: number): number {
  if (theirGain <= 0) return 0;
  const ratio = theirGain / (myGain + theirGain);
  // Peaks when the gains are balanced, falls away as it tilts either way.
  return round2(Math.max(0.05, Math.min(1, 2 * ratio)));
}

function describeSurplus(profile: TeamProfile, position: string): string {
  const s = profile.strengths.get(position);
  if (!s) return 'nothing';
  return s.surplus > 0 ? `${s.surplus} more ${position} than I can start` : `depth`;
}

function describeNeed(profile: TeamProfile, position: string): string {
  const s = profile.strengths.get(position);
  if (!s || s.starters.length < s.required) return 'an unfilled slot';
  return `a weak starter (${round2(s.weakestStarter)} pts/gm)`;
}
