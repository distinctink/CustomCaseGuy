/**
 * Turns a decision context (plus an optional news trigger) into a concrete,
 * explainable plan of moves — and executes it when asked.
 *
 * Every plan item carries the numbers that produced it, so a move can be
 * audited after the fact rather than taken on faith.
 */

import type { Player } from '../yahoo/types.js';
import type { DecisionContext } from './context.js';
import { valuePlayer, type Valuation } from './valuation.js';
import { chooseDropForAdd, type DropCandidate } from './roster.js';
import { evaluateClaim, rankClaims, type ClaimEvaluation } from './waiver.js';
import { round2 } from './scoring.js';
import { addDrop, placeWaiverClaim, type WriteOutcome } from '../yahoo/write.js';
import { movesInLastDay, recordMove, recordPendingClaim, addToWatchlist } from '../store/state.js';
import { clearTimeFor } from './claims.js';
import { invalidateContext } from './context.js';
import { logger } from '../util/log.js';

const log = logger('engine:decide');

export interface PlannedMove {
  kind: 'add' | 'addDrop' | 'waiverClaim';
  add: { playerKey: string; name: string; position: string; team: string };
  drop?: { playerKey: string; name: string; position: string };
  valueAdded: number;
  evaluation: ClaimEvaluation;
  /** One-paragraph rationale suitable for a log line or an alert. */
  rationale: string;
}

export interface Plan {
  leagueKey: string;
  week: number;
  myPriority: number;
  moves: PlannedMove[];
  /** Candidates we looked at and rejected, with the reason. */
  rejected: { name: string; reason: string }[];
  blockedBy?: string;
}

/** A news-derived hint that a specific player's role just changed. */
export interface RoleSignal {
  playerKey: string;
  roleChange: string;
  /** Free-text source, carried into the rationale. */
  source: string;
  /** Overrides the player's Yahoo injury status when ESPN is fresher. */
  injuryStatus?: string;
}

/**
 * Produce a plan. With no signals this is a general "is there an upgrade on the
 * wire" sweep; with signals it focuses on the players the news implicates.
 */
export function planMoves(ctx: DecisionContext, signals: RoleSignal[] = []): Plan {
  const signalByKey = new Map(signals.map((s) => [s.playerKey, s]));
  const rejected: { name: string; reason: string }[] = [];
  const moves: PlannedMove[] = [];

  const plan: Plan = {
    leagueKey: ctx.leagueKey,
    week: ctx.currentWeek,
    myPriority: ctx.waiver.myPriority,
    moves,
    rejected,
  };

  // Hard stop: daily transaction budget.
  const used = movesInLastDay();
  if (used >= ctx.strategy.execution.maxTransactionsPerDay) {
    plan.blockedBy =
      `daily transaction cap reached (${used}/${ctx.strategy.execution.maxTransactionsPerDay}); ` +
      `no autonomous moves until it rolls off`;
    return plan;
  }

  // Consider signalled players first, then the rest of the pool by value.
  const candidates = orderCandidates(ctx, signalByKey);

  for (const player of candidates) {
    const signal = signalByKey.get(player.playerKey);

    // Re-value with the news-derived role change applied.
    const base = ctx.valuations.get(player.playerKey);
    const valuation: Valuation | undefined = signal
      ? valuePlayer(
          {
            player,
            seasonPPG: base?.basePPG ?? 0,
            recentPPG: base?.basePPG ?? 0,
            gamesPlayed: Math.max(1, ctx.currentWeek - 1),
            roleChange: signal.roleChange,
            injuryStatus: signal.injuryStatus,
            currentWeek: ctx.currentWeek,
          },
          ctx.settings,
          ctx.strategy,
        )
      : base;

    if (!valuation) continue;

    const pairing = chooseDropForAdd(ctx.rosterAnalysis, valuation, ctx.strategy);
    if (!pairing) {
      rejected.push({ name: player.name, reason: 'roster is full and nothing is safely droppable' });
      continue;
    }

    const evaluation = evaluateClaim({
      player,
      valueAdded: pairing.valueAdded,
      context: ctx.waiver,
      strategy: ctx.strategy,
      expectedGamesOfUse: expectedGames(player, ctx),
    });

    if (evaluation.recommendation === 'wait_for_free_agency') {
      // "Wait" is only a strategy if we actually show up when he clears.
      // Otherwise it is just a decision to lose him to a more attentive manager.
      const clearsAt = clearTimeFor(player, ctx.strategy.execution.waiverProcessingHour);
      addToWatchlist({
        playerKey: player.playerKey,
        playerName: player.name,
        position: valuation.position,
        clearsAt: clearsAt ?? Date.now(),
        valueAdded: round2(pairing.valueAdded),
        reason: evaluation.reasons.join('; '),
      });
      rejected.push({
        name: player.name,
        reason: `${evaluation.reasons.join('; ')} — watchlisted for ${
          clearsAt ? new Date(clearsAt).toLocaleString() : 'immediate pickup'
        }`,
      });
      continue;
    }

    if (evaluation.recommendation === 'skip') {
      rejected.push({ name: player.name, reason: evaluation.reasons.join('; ') });
      continue;
    }

    const kind = evaluation.recommendation === 'claim'
      ? 'waiverClaim' as const
      : pairing.drop ? 'addDrop' as const : 'add' as const;

    moves.push({
      kind,
      add: {
        playerKey: player.playerKey,
        name: player.name,
        position: valuation.position,
        team: player.team,
      },
      drop: pairing.drop
        ? {
            playerKey: pairing.drop.player.playerKey,
            name: pairing.drop.player.name,
            position: pairing.drop.valuation.position,
          }
        : undefined,
      valueAdded: round2(pairing.valueAdded),
      evaluation,
      rationale: buildRationale(player, valuation, pairing, evaluation, signal, ctx),
    });
  }

  // Only the top-EV claim is realistically winnable — winning one drops us to
  // the back of the queue — so file one claim per run. Free-agent adds are
  // unconstrained by priority and can stack up to the daily cap.
  const claims = rankClaims(moves.filter((m) => m.kind === 'waiverClaim').map((m) => m.evaluation));
  const topClaimKey = claims[0]?.playerKey;
  const budget = ctx.strategy.execution.maxTransactionsPerDay - used;

  plan.moves = moves
    .filter((m) => m.kind !== 'waiverClaim' || m.add.playerKey === topClaimKey)
    .slice(0, Math.max(0, budget));

  for (const m of moves) {
    if (!plan.moves.includes(m)) {
      rejected.push({
        name: m.add.name,
        reason: m.kind === 'waiverClaim'
          ? 'a higher-EV claim takes precedence this waiver run'
          : 'daily transaction budget exhausted',
      });
    }
  }

  return plan;
}

function orderCandidates(ctx: DecisionContext, signals: Map<string, RoleSignal>): Player[] {
  const signalled: Player[] = [];
  const rest: Player[] = [];
  for (const p of ctx.available) {
    (signals.has(p.playerKey) ? signalled : rest).push(p);
  }
  rest.sort(
    (a, b) =>
      (ctx.valuations.get(b.playerKey)?.adjustedValue ?? 0) -
      (ctx.valuations.get(a.playerKey)?.adjustedValue ?? 0),
  );
  // A news burst is the reason we woke up; look at those players first, then
  // sweep the top of the pool for anything obvious we are missing.
  return [...signalled, ...rest.slice(0, 25)];
}

/**
 * How many games we expect to actually use this player. A handcuff picked up
 * because the starter is week-to-week is worth less than a permanent upgrade.
 */
function expectedGames(player: Player, ctx: DecisionContext): number {
  const weeks = ctx.weeksRemaining;
  if (player.byeWeek && player.byeWeek >= ctx.currentWeek) return Math.max(0, weeks - 1);
  return weeks;
}

function buildRationale(
  player: Player,
  valuation: Valuation,
  pairing: { drop?: DropCandidate; valueAdded: number; reason: string },
  evaluation: ClaimEvaluation,
  signal: RoleSignal | undefined,
  ctx: DecisionContext,
): string {
  const parts: string[] = [];
  if (signal) parts.push(`Trigger: ${signal.source}`);
  parts.push(pairing.reason);
  if (valuation.notes.length) parts.push(`Valuation: ${valuation.notes.join(', ')}`);
  parts.push(
    evaluation.recommendation === 'claim'
      ? `Waiver claim at priority #${ctx.waiver.myPriority}: ${evaluation.reasons.join('; ')}`
      : `Free-agent add: ${evaluation.reasons.join('; ')}`,
  );
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  move: PlannedMove;
  outcome?: WriteOutcome;
  error?: string;
}

/** Execute a plan against Yahoo. Respects DRY_RUN via the write layer. */
export async function executePlan(ctx: DecisionContext, plan: Plan): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const move of plan.moves) {
    try {
      const outcome = move.kind === 'waiverClaim'
        ? await placeWaiverClaim({
            leagueKey: ctx.leagueKey,
            teamKey: ctx.myTeam.teamKey,
            addPlayerKey: move.add.playerKey,
            dropPlayerKey: move.drop?.playerKey,
          })
        : await addDrop({
            leagueKey: ctx.leagueKey,
            teamKey: ctx.myTeam.teamKey,
            addPlayerKey: move.add.playerKey,
            dropPlayerKey: move.drop?.playerKey,
          });

      recordMove({
        at: Date.now(),
        kind: move.kind,
        addPlayerKey: move.add.playerKey,
        addPlayerName: move.add.name,
        dropPlayerKey: move.drop?.playerKey,
        dropPlayerName: move.drop?.name,
        reason: move.rationale,
        transactionKey: outcome.transactionKey,
        dryRun: outcome.dryRun,
      });

      if (move.kind === 'waiverClaim' && outcome.transactionKey) {
        recordPendingClaim(outcome.transactionKey, {
          playerKey: move.add.playerKey,
          playerName: move.add.name,
          reason: move.rationale,
        });
      }

      log.info(`${outcome.dryRun ? '[dry run] ' : ''}${move.kind}: ${move.add.name}`, move.rationale);
      results.push({ move, outcome });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(`Failed ${move.kind} for ${move.add.name}: ${message}`);
      results.push({ move, error: message });
    }
  }

  if (results.some((r) => r.outcome && !r.outcome.dryRun)) invalidateContext();
  return results;
}
