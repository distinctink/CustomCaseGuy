#!/usr/bin/env node
/**
 * Command-line entry point.
 *
 *   ffm auth [--manual]        authorise with Yahoo
 *   ffm doctor                 probe every endpoint and report what works
 *   ffm league [list]          show league settings, or list your leagues
 *   ffm roster                 show your roster with valuations
 *   ffm free-agents [POS]      show the top of the wire
 *   ffm plan                   what the engine would do right now (no writes)
 *   ffm run                    plan and execute once
 *   ffm watch                  the persistent loop
 *   ffm approvals [...]        review and approve trade decisions
 */

import { authorize } from '../yahoo/authFlow.js';
import { hasTokens, loadTokens } from '../yahoo/oauth.js';
import {
  getMyLeagues, getLeagueSettings, getMyTeam, getFreeAgents, getWaiverPriorities, getTransactions,
} from '../yahoo/read.js';
import { getNews, getInjuries, getTeams as getEspnTeams, getScoreboard as getEspnScoreboard } from '../espn/api.js';
import { buildContext } from '../engine/context.js';
import { planMoves, executePlan } from '../engine/decide.js';
import { priorityOptionValue } from '../engine/waiver.js';
import { watch, requestStop } from '../watcher/index.js';
import { listApprovals, approve, reject } from '../store/approvals.js';
import { loadState, movesInLastDay } from '../store/state.js';
import { env, loadStrategy } from '../config.js';

const out = (s = '') => process.stdout.write(`${s}\n`);

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);

  switch (command) {
    case 'auth': return cmdAuth(args);
    case 'doctor': return cmdDoctor();
    case 'league': return cmdLeague(args);
    case 'roster': return cmdRoster();
    case 'free-agents':
    case 'fa': return cmdFreeAgents(args);
    case 'plan': return cmdPlan(false);
    case 'run': return cmdPlan(true);
    case 'watch': return cmdWatch(args);
    case 'approvals': return cmdApprovals(args);
    case 'log': return cmdLog();
    case 'help':
    case '--help':
    case '-h': return cmdHelp();
    default:
      out(`Unknown command: ${command}\n`);
      cmdHelp();
      process.exitCode = 1;
  }
}

function cmdHelp() {
  out(`Yahoo Fantasy Football manager

  ffm auth [--manual]     Authorise with Yahoo (opens a consent URL)
  ffm doctor              Probe Yahoo + ESPN endpoints and report status
  ffm league list         List your leagues and their keys
  ffm league              Show settings and scoring for the pinned league
  ffm roster              Your roster, valued under league scoring
  ffm free-agents [POS]   Top available players (optionally by position)
  ffm plan                What the engine would do right now — no writes
  ffm run                 Plan and execute once
  ffm watch [--once]      Run the persistent watcher
  ffm approvals           List pending trade approvals
  ffm approvals approve <id>
  ffm approvals reject <id> [reason]
  ffm log                 Transactions this system has made

Environment: DRY_RUN=1 makes every write a no-op that logs its payload.`);
}

// ---------------------------------------------------------------------------

async function cmdAuth(args: string[]) {
  const mode = args.includes('--manual') ? 'manual' : args.includes('--server') ? 'server' : 'auto';
  const tokens = await authorize(mode);
  out(`\nAuthorised. Token stored at ${env.tokenPath}`);
  out(`Access token expires ${new Date(tokens.expires_at).toLocaleString()}`);

  const leagues = await getMyLeagues();
  if (!leagues.length) {
    out('\nNo NFL leagues found on this account for the current season.');
    return;
  }
  out('\nYour leagues:');
  for (const l of leagues) {
    out(`  ${l.leagueKey}  ${l.name}  (${l.numTeams} teams, ${l.usesFaab ? 'FAAB' : 'waiver priority'})`);
  }
  out(`\nPin one by adding to .env:  YAHOO_LEAGUE_KEY=${leagues[0]!.leagueKey}`);
}

// ---------------------------------------------------------------------------

interface Probe { name: string; ok: boolean; detail: string }

async function cmdDoctor() {
  out('Checking configuration and endpoints…\n');
  const probes: Probe[] = [];

  const push = async (name: string, fn: () => Promise<string>) => {
    try {
      probes.push({ name, ok: true, detail: await fn() });
    } catch (e) {
      probes.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  // Config
  probes.push({
    name: 'YAHOO_CLIENT_ID',
    ok: !!process.env.YAHOO_CLIENT_ID,
    detail: process.env.YAHOO_CLIENT_ID ? 'set' : 'missing — copy .env.example to .env',
  });
  probes.push({
    name: 'YAHOO_CLIENT_SECRET',
    ok: !!process.env.YAHOO_CLIENT_SECRET,
    detail: process.env.YAHOO_CLIENT_SECRET ? 'set' : 'missing',
  });
  const tokens = loadTokens();
  probes.push({
    name: 'Yahoo tokens',
    ok: hasTokens(),
    detail: tokens
      ? `stored, access token ${Date.now() < tokens.expires_at ? 'valid' : 'expired (will refresh)'}`
      : 'not authorised — run `ffm auth`',
  });

  // ESPN — no auth needed, so these work even before Yahoo is set up.
  await push('ESPN news', async () => {
    const news = await getNews(5);
    return `${news.length} articles, newest: "${news[0]?.headline ?? 'n/a'}"`;
  });
  await push('ESPN injuries', async () => {
    const inj = await getInjuries();
    const withCode = inj.filter((i) => i.code);
    return `${inj.length} rows, ${withCode.length} with an active designation`;
  });
  await push('ESPN teams', async () => `${(await getEspnTeams()).length} teams`);
  await push('ESPN scoreboard', async () => {
    const games = await getEspnScoreboard();
    return `${games.length} games${games[0] ? `, first: ${games[0].shortName}` : ''}`;
  });

  // Yahoo — only if authorised.
  if (hasTokens()) {
    await push('Yahoo leagues', async () => {
      const leagues = await getMyLeagues();
      return leagues.length
        ? leagues.map((l) => `${l.leagueKey} (${l.name})`).join(', ')
        : 'authorised but no NFL leagues found';
    });

    if (env.leagueKey) {
      await push('Yahoo league settings', async () => {
        const s = await getLeagueSettings();
        return `${s.league.name}: week ${s.league.currentWeek}, ` +
          `${s.startingSlots.length} starting slots, ${s.statModifiers.size} scored categories, ` +
          `${s.league.usesFaab ? 'FAAB' : 'waiver priority'}`;
      });
      await push('Yahoo my team', async () => {
        const t = await getMyTeam();
        return `${t.name} (${t.teamKey}), waiver priority #${t.waiverPriority ?? '?'}`;
      });
      await push('Yahoo free agents', async () => {
        const fa = await getFreeAgents(undefined, { limit: 5 });
        return `${fa.length} returned, top: ${fa[0]?.name ?? 'n/a'}` +
          (fa[0]?.ownership ? ` (ownership field present: ${fa[0].ownership})` : ' (no ownership field — sub-resource may be unsupported)');
      });
      await push('Yahoo waiver priorities', async () => {
        const order = await getWaiverPriorities();
        return order.length ? order.map((t) => `#${t.waiverPriority} ${t.name}`).join(', ') : 'no priorities exposed';
      });
      await push('Yahoo transactions', async () => `${(await getTransactions(undefined, { count: 10 })).length} recent`);
    } else {
      probes.push({ name: 'YAHOO_LEAGUE_KEY', ok: false, detail: 'not set — league-scoped checks skipped' });
    }
  } else {
    probes.push({ name: 'Yahoo API checks', ok: false, detail: 'skipped, not authorised' });
  }

  const width = Math.max(...probes.map((p) => p.name.length));
  for (const p of probes) {
    out(`  ${p.ok ? '✓' : '✗'} ${p.name.padEnd(width)}  ${p.detail}`);
  }

  const failed = probes.filter((p) => !p.ok);
  out(`\n${probes.length - failed.length}/${probes.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

// ---------------------------------------------------------------------------

async function cmdLeague(args: string[]) {
  if (args[0] === 'list') {
    const leagues = await getMyLeagues();
    for (const l of leagues) {
      out(`${l.leagueKey}  ${l.name}  ${l.numTeams} teams  week ${l.currentWeek}  ${l.usesFaab ? 'FAAB' : 'waiver priority'}`);
    }
    return;
  }

  const s = await getLeagueSettings();
  out(`${s.league.name} (${s.league.leagueKey})`);
  out(`Season ${s.league.season}, week ${s.league.currentWeek} of ${s.league.endWeek}`);
  out(`${s.league.numTeams} teams, ${s.league.scoringType} scoring`);
  out(`Waivers: ${s.league.usesFaab ? 'FAAB' : 'priority'} (type ${s.league.waiverType}, rule ${s.league.waiverRule})`);
  out(`\nStarting lineup:`);
  for (const slot of s.startingSlots) out(`  ${slot.count} x ${slot.position}`);
  out(`  ${s.benchCount} x BN${s.irCount ? `, ${s.irCount} x IR` : ''}`);

  out(`\nScoring (${s.statModifiers.size} categories):`);
  const byId = new Map(s.statCategories.map((c) => [c.statId, c]));
  for (const [id, value] of [...s.statModifiers].sort((a, b) => a[0] - b[0])) {
    out(`  ${(byId.get(id)?.displayName ?? `stat ${id}`).padEnd(24)} ${value}`);
  }
}

async function cmdRoster() {
  const ctx = await buildContext({ force: true });
  out(`${ctx.myTeam.name} — week ${ctx.currentWeek}, waiver priority #${ctx.waiver.myPriority}/${ctx.waiver.numTeams}`);
  out(`Roster ${ctx.rosterAnalysis.rosterSize}/${ctx.rosterAnalysis.maxRosterSize}` +
    (ctx.rosterAnalysis.openSpots ? ` (${ctx.rosterAnalysis.openSpots} open)` : ''));
  out('');
  out(pad('SLOT', 6) + pad('PLAYER', 26) + pad('POS', 5) + pad('TM', 4) + pad('ST', 4) + pad('PPG', 7) + 'DROPPABLE');
  for (const c of ctx.rosterAnalysis.candidates) {
    out(
      pad(c.player.selectedPosition ?? '-', 6) +
        pad(c.player.name, 26) +
        pad(c.valuation.position, 5) +
        pad(c.player.team, 4) +
        pad(c.player.status || '-', 4) +
        pad(c.valuation.projectedPPG.toFixed(1), 7) +
        (c.droppable ? 'yes' : `no — ${c.blockers[0]}`),
    );
  }
}

async function cmdFreeAgents(args: string[]) {
  const position = args[0]?.toUpperCase();
  const players = await getFreeAgents(undefined, { position, limit: 25 });
  out(pad('PLAYER', 26) + pad('POS', 6) + pad('TM', 4) + pad('ST', 4) + pad('OWN%', 7) + pad('Δ', 6) + 'AVAILABILITY');
  for (const p of players) {
    out(
      pad(p.name, 26) +
        pad(p.displayPosition, 6) +
        pad(p.team, 4) +
        pad(p.status || '-', 4) +
        pad(p.percentOwned !== undefined ? `${p.percentOwned}%` : '-', 7) +
        pad(p.percentOwnedDelta !== undefined ? `${p.percentOwnedDelta > 0 ? '+' : ''}${p.percentOwnedDelta}` : '-', 6) +
        (p.ownership ?? '-'),
    );
  }
}

async function cmdPlan(execute: boolean) {
  const ctx = await buildContext({ force: true });
  const strategy = loadStrategy();
  const plan = planMoves(ctx);

  out(`Week ${plan.week} — waiver priority #${plan.myPriority}/${ctx.waiver.numTeams}, ` +
    `${ctx.weeksRemaining} weeks left`);
  out(`Priority option value: ${priorityOptionValue(plan.myPriority, ctx.weeksRemaining, strategy)} pts`);
  out(`Active rivals at priorities: ${ctx.waiver.activeRivalPriorities.join(', ') || 'none detected'}`);
  out(`Transactions used today: ${movesInLastDay()}/${strategy.execution.maxTransactionsPerDay}\n`);

  if (plan.blockedBy) {
    out(`BLOCKED: ${plan.blockedBy}`);
    return;
  }
  if (!plan.moves.length) {
    out('No moves recommended.');
    if (plan.rejected.length) {
      out('\nConsidered and rejected:');
      for (const r of plan.rejected.slice(0, 10)) out(`  ${r.name}: ${r.reason}`);
    }
    return;
  }

  for (const m of plan.moves) {
    out(`${m.kind.toUpperCase()}  ${m.add.name} (${m.add.position}, ${m.add.team})` +
      (m.drop ? `  ⟵ drop ${m.drop.name}` : ''));
    out(`  value added: +${m.valueAdded} pts/gm over the rest of the season = ${m.evaluation.seasonValue}`);
    out(`  P(win claim) ${fmtPct(m.evaluation.probabilityWinClaim)}  ` +
      `P(contested) ${fmtPct(m.evaluation.probabilityContested)}  ` +
      `P(clears) ${fmtPct(m.evaluation.probabilityClearsToFreeAgency)}`);
    out(`  EV claim ${m.evaluation.evClaim} vs EV wait ${m.evaluation.evWait}, priority cost ${m.evaluation.priorityCost}`);
    out(`  ${m.rationale}`);
    out('');
  }

  if (!execute) {
    out('Dry plan only. Run `ffm run` to execute.');
    return;
  }

  const results = await executePlan(ctx, plan);
  for (const r of results) {
    out(r.error ? `FAILED ${r.move.add.name}: ${r.error}` : `${r.outcome?.detail}`);
  }
}

async function cmdWatch(args: string[]) {
  const once = args.includes('--once');
  const planOnly = args.includes('--plan-only');
  process.on('SIGINT', () => {
    out('\nStopping…');
    requestStop();
    setTimeout(() => process.exit(0), 500);
  });
  await watch({ once, planOnly });
}

async function cmdApprovals(args: string[]) {
  const [action, id, ...rest] = args;

  if (action === 'approve') {
    if (!id) throw new Error('Usage: ffm approvals approve <id>');
    const req = approve(id);
    out(`Approved ${req.id}: ${req.summary}`);
    out(`\nSingle-use token (expires in 24h):\n\n  ${req.token}\n`);
    out('Supply it as approvalToken to propose_trade / respond_to_trade.');
    return;
  }

  if (action === 'reject') {
    if (!id) throw new Error('Usage: ffm approvals reject <id> [reason]');
    const req = reject(id, rest.join(' '));
    out(`Rejected ${req.id}: ${req.summary}`);
    return;
  }

  const all = listApprovals();
  const pending = all.filter((r) => r.status === 'pending');
  if (!pending.length) out('No pending approvals.');
  for (const r of pending) {
    out(`${r.id}  ${new Date(r.createdAt).toLocaleString()}`);
    out(`  ${r.summary}`);
    if (r.payload.rationale) out(`  rationale: ${String(r.payload.rationale)}`);
    out(`  approve: ffm approvals approve ${r.id}`);
    out('');
  }

  const others = all.filter((r) => r.status !== 'pending').slice(-5);
  if (others.length) {
    out('Recent decisions:');
    for (const r of others) out(`  ${r.id}  ${r.status.padEnd(9)} ${r.summary}`);
  }
}

async function cmdLog() {
  const state = loadState();
  out(`Transactions in the last 24h: ${movesInLastDay(state)}`);
  if (Object.keys(state.pendingClaims).length) {
    out('\nPending waiver claims:');
    for (const [key, c] of Object.entries(state.pendingClaims)) {
      out(`  ${key}  ${c.playerName}  filed ${new Date(c.filedAt).toLocaleString()}`);
    }
  }
  out('\nHistory:');
  for (const m of state.moves.slice(-25).reverse()) {
    out(`${new Date(m.at).toLocaleString()}  ${m.dryRun ? '[dry] ' : ''}${m.kind}  ` +
      `${m.addPlayerName ?? ''}${m.dropPlayerName ? ` / dropped ${m.dropPlayerName}` : ''}`);
    out(`  ${m.reason}`);
  }
}

// ---------------------------------------------------------------------------

function pad(s: string, n: number): string {
  const t = s.length > n - 1 ? `${s.slice(0, n - 2)}…` : s;
  return t.padEnd(n);
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

main().catch((e) => {
  process.stderr.write(`\n${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
