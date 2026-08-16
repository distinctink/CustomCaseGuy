/**
 * Waiver-priority strategy.
 *
 * This league uses WAIVER PRIORITY, not FAAB. That changes the problem
 * completely from the usual "how much do I bid" question:
 *
 *  - A contested waiver claim is decided by priority number at the processing
 *    deadline. Clicking faster does nothing.
 *  - Winning a claim sends you to the back of the priority queue, so priority
 *    is a consumable resource with option value for the rest of the season.
 *  - Once waivers clear, unclaimed players become free agents on a first-come
 *    basis. *That* is where speed wins, and it costs no priority at all.
 *
 * So the real decision is never "do I want this player" — it is "do I want him
 * enough to spend priority, or can I wait 48 hours and take him for free?"
 *
 * We answer it with an explicit expected-value comparison:
 *
 *   EV(claim) = P(win) x (value - priorityCost) + (1 - P(win)) x P(clears) x value
 *   EV(wait)  = P(nobody claims) x value
 *
 * where P(win) depends only on rivals holding *better* priority than us, and
 * priorityCost is the option value we give up by dropping to the back.
 */

import type { StrategyConfig } from '../config.js';
import type { Team, Transaction, Player } from '../yahoo/types.js';
import { round2 } from './scoring.js';

export interface WaiverContext {
  /** Our current waiver priority (1 = next in line). */
  myPriority: number;
  /** Number of teams in the league. */
  numTeams: number;
  /** Priorities held by rivals we consider genuinely active. */
  activeRivalPriorities: number[];
  /** Fantasy weeks remaining in the regular season, including this one. */
  weeksRemaining: number;
}

export interface ClaimEvaluation {
  playerKey: string;
  playerName: string;
  /** 'waivers' or 'freeagents' — determines whether priority is even at stake. */
  availability: string;
  /** Points per game we gain over the player we would drop. */
  valueAdded: number;
  /** valueAdded projected across the games we expect to use them. */
  seasonValue: number;
  probabilityWinClaim: number;
  probabilityContested: number;
  probabilityClearsToFreeAgency: number;
  priorityCost: number;
  evClaim: number;
  evWait: number;
  recommendation: 'claim' | 'add_now' | 'wait_for_free_agency' | 'skip';
  reasons: string[];
}

/**
 * Option value of holding priority slot `p`.
 *
 * Decays geometrically down the queue (being #1 is worth far more than being
 * #2) and linearly as the season runs out (fewer remaining chances to cash it
 * in). Both curves are tunable in strategy.json.
 */
export function priorityOptionValue(
  priority: number,
  weeksRemaining: number,
  strategy: StrategyConfig,
): number {
  const w = strategy.waiver;
  if (!Number.isFinite(priority) || priority < 1) return 0;
  const seasonFactor = Math.max(0, Math.min(1, weeksRemaining / Math.max(1, w.regularSeasonWeeks)));
  return round2(w.priorityOneValue * w.priorityDecay ** (priority - 1) * seasonFactor);
}

/**
 * What it costs us to win a claim: we move from our current slot to the back
 * of the queue.
 */
export function priorityCostOfWinning(ctx: WaiverContext, strategy: StrategyConfig): number {
  const before = priorityOptionValue(ctx.myPriority, ctx.weeksRemaining, strategy);
  const after = priorityOptionValue(ctx.numTeams, ctx.weeksRemaining, strategy);
  return round2(Math.max(0, before - after));
}

/**
 * Probability a single active rival files a claim on this player.
 *
 * Signals, all free:
 *  - `valueAdded` relative to the threshold that would tempt anyone
 *  - Yahoo's rostered-percentage delta, which is the closest thing to a live
 *    measure of the whole platform pouncing on someone
 *
 * The logistic keeps it bounded and makes the mid-range behave sensibly.
 */
export function rivalClaimProbability(
  valueAdded: number,
  percentOwnedDelta: number | undefined,
  strategy: StrategyConfig,
): number {
  const threshold = strategy.waiver.minValueAdded;
  // Centre the curve slightly above our own action threshold: a rival needs a
  // real reason to spend priority too.
  const valueSignal = (valueAdded - threshold * 1.2) / Math.max(0.5, threshold);
  const hypeSignal = Math.min(3, Math.max(0, (percentOwnedDelta ?? 0) / 5));
  // The intercept encodes how passive this league's managers are; it is the
  // single biggest lever on how often we spend priority, so it lives in config.
  const z = 1.1 * valueSignal + 0.7 * hypeSignal - strategy.waiver.rivalPassivity;
  const p = 1 / (1 + Math.exp(-z));
  return clamp(p, 0.02, 0.95);
}

/**
 * Identify which rivals are worth modelling. In a 12-team league where only a
 * few managers pay attention, treating all 11 as threats would make us claim
 * far too aggressively.
 */
export function activeRivalTeams(
  teams: Team[],
  transactions: Transaction[],
  myTeamKey: string,
  strategy: StrategyConfig,
): Team[] {
  const cutoff = Date.now() - strategy.waiver.activeRivalLookbackDays * 24 * 60 * 60 * 1000;
  const activeKeys = new Set<string>();

  for (const t of transactions) {
    if (t.timestamp < cutoff) continue;
    for (const p of t.players) {
      if (p.destinationTeamKey) activeKeys.add(p.destinationTeamKey);
      if (p.sourceTeamKey) activeKeys.add(p.sourceTeamKey);
    }
  }

  const rivals = teams.filter((t) => t.teamKey !== myTeamKey);
  const observed = rivals.filter((t) => activeKeys.has(t.teamKey));

  // Fall back to the configured count when we have no transaction history yet
  // (e.g. week 1), ranked by total moves made.
  if (observed.length === 0) {
    return [...rivals]
      .sort((a, b) => b.numberOfMoves - a.numberOfMoves)
      .slice(0, strategy.waiver.activeRivals);
  }
  return observed;
}

/**
 * The core decision.
 *
 * `valueAdded` is points per game gained over the player we would drop. It must
 * already account for injury status and role — see engine/valuation.ts.
 */
export function evaluateClaim(opts: {
  player: Player;
  valueAdded: number;
  context: WaiverContext;
  strategy: StrategyConfig;
  /** Games we expect to actually start this player. Defaults to weeks remaining. */
  expectedGamesOfUse?: number;
}): ClaimEvaluation {
  const { player, valueAdded, context, strategy } = opts;
  const reasons: string[] = [];

  const availability = player.ownership ?? (player.waiverDate ? 'waivers' : 'freeagents');
  const games = opts.expectedGamesOfUse ?? context.weeksRemaining;
  const seasonValue = round2(Math.max(0, valueAdded) * Math.max(0, games));

  const pRivalClaims = rivalClaimProbability(valueAdded, player.percentOwnedDelta, strategy);

  // We lose a contested claim only to rivals ahead of us in the queue.
  const rivalsAhead = context.activeRivalPriorities.filter((p) => p < context.myPriority);
  const pWin = rivalsAhead.reduce((acc, _p) => acc * (1 - pRivalClaims), 1);

  // The player clears to free agency only if nobody at all claims him.
  const pAnyClaims = 1 - context.activeRivalPriorities.reduce((acc) => acc * (1 - pRivalClaims), 1);
  const pClears = 1 - pAnyClaims;

  const priorityCost = priorityCostOfWinning(context, strategy);

  // Losing a claim is not a dead loss: the player may still clear to free
  // agency, where we can grab him for nothing.
  const evClaim = round2(pWin * (seasonValue - priorityCost) + (1 - pWin) * pClears * seasonValue);
  const evWait = round2(pClears * seasonValue);

  const evaluation: ClaimEvaluation = {
    playerKey: player.playerKey,
    playerName: player.name,
    availability,
    valueAdded: round2(valueAdded),
    seasonValue,
    probabilityWinClaim: round3(pWin),
    probabilityContested: round3(pAnyClaims),
    probabilityClearsToFreeAgency: round3(pClears),
    priorityCost,
    evClaim,
    evWait,
    recommendation: 'skip',
    reasons,
  };

  // --- Gate 1: is the player worth anything to us at all? ------------------
  if (valueAdded < strategy.waiver.minValueAdded) {
    reasons.push(
      `value added ${round2(valueAdded)} pts/gm is below the ${strategy.waiver.minValueAdded} threshold`,
    );
    evaluation.recommendation = 'skip';
    return evaluation;
  }

  // --- Gate 2: free agents cost no priority, so just take them -------------
  if (availability === 'freeagents') {
    reasons.push('already a free agent — first come, no priority spent');
    evaluation.recommendation = 'add_now';
    return evaluation;
  }

  // --- Gate 3: claim vs wait ----------------------------------------------
  if (pAnyClaims < strategy.waiver.contestThreshold) {
    reasons.push(
      `only ${pct(pAnyClaims)} chance a rival claims him (below the ${pct(strategy.waiver.contestThreshold)} ` +
        `contest threshold) — expect him to clear, take him free`,
    );
    evaluation.recommendation = 'wait_for_free_agency';
    return evaluation;
  }

  if (evClaim > evWait) {
    reasons.push(
      `claiming is worth ${evClaim} vs ${evWait} for waiting`,
      `${pct(pWin)} chance of winning at priority #${context.myPriority}`,
      `burning priority costs ${priorityCost} pts of option value with ${context.weeksRemaining} weeks left`,
    );
    evaluation.recommendation = 'claim';
    return evaluation;
  }

  reasons.push(
    `waiting is worth ${evWait} vs ${evClaim} for claiming`,
    `priority cost ${priorityCost} outweighs the ${pct(pWin)} chance of winning`,
  );
  evaluation.recommendation = 'wait_for_free_agency';
  return evaluation;
}

/**
 * Rank several claims we could file in one waiver run. Yahoo processes our
 * claims in the order we set, and winning the first one drops our priority, so
 * only the top claim is likely to land — order by expected value.
 */
export function rankClaims(evaluations: ClaimEvaluation[]): ClaimEvaluation[] {
  return [...evaluations]
    .filter((e) => e.recommendation === 'claim')
    .sort((a, b) => b.evClaim - a.evClaim);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
