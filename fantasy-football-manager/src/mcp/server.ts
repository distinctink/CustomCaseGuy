#!/usr/bin/env node
/**
 * MCP server for Yahoo Fantasy Football.
 *
 * Read tools cover roster, league rules, player pool, transactions, standings
 * and waiver priority. Write tools cover add, drop, waiver claims and lineup.
 * Trade tools stop at "propose to the human" — the approval token that Yahoo's
 * trade endpoints require is only mintable from the CLI.
 *
 * Transport is stdio, so nothing here may write to stdout except the protocol
 * itself; all logging goes to stderr (see util/log.ts).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  getMyLeagues, getLeagueSettings, getTeams, getMyTeam, getRoster, getRosterWithStats,
  getFreeAgents, getWaiverPlayers, getAvailablePlayers, getPlayersByKeys, getPlayerStats,
  getTransactions, getPendingTrades, getScoreboard, getStandings, getWaiverPriorities,
  resolveLeagueKey,
} from '../yahoo/read.js';
import { addDrop, dropPlayer, placeWaiverClaim, cancelWaiverClaim, setClaimPriority, setLineup, proposeTrade, respondToTrade } from '../yahoo/write.js';
import { buildContext } from '../engine/context.js';
import { optimiseLineup, changedSlotsOnly, lockedTeamsFromGames } from '../engine/lineup.js';
import { reconcileClaims, clearTimeFor, hoursUntilClear } from '../engine/claims.js';
import { generateTradeIdeas } from '../engine/trades.js';
import { addToWatchlist, removeFromWatchlist } from '../store/state.js';
import { planMoves, executePlan } from '../engine/decide.js';
import { evaluateClaim, priorityOptionValue } from '../engine/waiver.js';
import { explainScore } from '../engine/scoring.js';
import { requestApproval, listApprovals } from '../store/approvals.js';
import { loadState, movesInLastDay } from '../store/state.js';
import { hasTokens } from '../yahoo/oauth.js';
import { getNews, getInjuries, getScoreboard as getEspnScoreboard } from '../espn/api.js';
import { env } from '../config.js';
import { logger } from '../util/log.js';

const log = logger('mcp');

const server = new McpServer({ name: 'yahoo-fantasy-football', version: '0.1.0' });

/** Maps and BigInts do not survive JSON.stringify; flatten them. */
function serialize(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => {
      if (v instanceof Map) return Object.fromEntries(v);
      if (typeof v === 'bigint') return String(v);
      return v;
    },
    2,
  );
}

function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: serialize(value) }] };
}

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  log.error(message);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

/** Wrap a handler so a thrown error becomes a protocol-level tool error. */
function tool<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (e) {
      return fail(e);
    }
  };
}

const leagueArg = { leagueKey: z.string().optional().describe('Yahoo league key, e.g. 461.l.123456. Defaults to YAHOO_LEAGUE_KEY.') };

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

server.registerTool(
  'yahoo_status',
  {
    title: 'Connection status',
    description: 'Check whether Yahoo OAuth is configured, which league is pinned, and whether writes are in dry-run mode.',
    inputSchema: {},
  },
  tool(async () => ({
    authorised: hasTokens(),
    pinnedLeagueKey: env.leagueKey ?? null,
    dryRun: env.dryRun,
    movesLast24h: movesInLastDay(),
    pendingApprovals: listApprovals('pending').length,
    hint: hasTokens() ? undefined : 'Run `npm run auth` to authorise with Yahoo.',
  })),
);

server.registerTool(
  'list_leagues',
  {
    title: 'List my leagues',
    description: 'Every NFL fantasy league the authorised Yahoo account plays in, with league keys.',
    inputSchema: { gameKey: z.string().optional().describe('Yahoo game key; defaults to "nfl" (current season).') },
  },
  tool(async ({ gameKey }: { gameKey?: string }) => getMyLeagues(gameKey)),
);

server.registerTool(
  'get_league_settings',
  {
    title: 'League settings and scoring',
    description:
      'Roster slots, scoring categories and per-stat point modifiers, plus waiver type (priority vs FAAB). ' +
      'This is the authoritative source for how players should be valued.',
    inputSchema: leagueArg,
  },
  tool(async ({ leagueKey }: { leagueKey?: string }) => {
    const s = await getLeagueSettings(leagueKey);
    return { ...s, statModifiers: Object.fromEntries(s.statModifiers) };
  }),
);

server.registerTool(
  'get_my_roster',
  {
    title: 'My roster',
    description: 'The authorised user\'s current roster, with lineup slots, injury status and eligibility.',
    inputSchema: { ...leagueArg, week: z.number().int().optional(), withStats: z.boolean().optional().describe('Include this week\'s fantasy points.') },
  },
  tool(async ({ leagueKey, week, withStats }: { leagueKey?: string; week?: number; withStats?: boolean }) => {
    const team = await getMyTeam(leagueKey);
    const settings = await getLeagueSettings(leagueKey);
    const target = week ?? settings.league.currentWeek;
    const roster = withStats ? await getRosterWithStats(team.teamKey, target) : await getRoster(team.teamKey, target);
    return { team, roster };
  }),
);

server.registerTool(
  'get_team_roster',
  {
    title: 'Any team roster',
    description: 'Roster for a specific team key — use it to see what a rival is thin at before assessing waiver competition.',
    inputSchema: { teamKey: z.string(), week: z.number().int().optional() },
  },
  tool(async ({ teamKey, week }: { teamKey: string; week?: number }) => getRoster(teamKey, week)),
);

server.registerTool(
  'list_free_agents',
  {
    title: 'Free agents',
    description:
      'Players who have already cleared waivers. These are first-come: adding one costs no waiver priority, ' +
      'so speed is the only thing that matters.',
    inputSchema: {
      ...leagueArg,
      position: z.string().optional().describe('QB, RB, WR, TE, K, DEF'),
      limit: z.number().int().min(1).max(200).optional(),
      sort: z.enum(['OR', 'AR', 'PTS', 'PR', 'NAME']).optional(),
    },
  },
  tool(async (a: { leagueKey?: string; position?: string; limit?: number; sort?: 'OR' | 'AR' | 'PTS' | 'PR' | 'NAME' }) =>
    getFreeAgents(a.leagueKey, { position: a.position, limit: a.limit ?? 25, sort: a.sort })),
);

server.registerTool(
  'list_waiver_players',
  {
    title: 'Players on waivers',
    description:
      'Players currently sitting on waivers. Adding one requires a claim decided by waiver priority at the ' +
      'processing deadline, not by who clicks first.',
    inputSchema: {
      ...leagueArg,
      position: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  tool(async (a: { leagueKey?: string; position?: string; limit?: number }) =>
    getWaiverPlayers(a.leagueKey, { position: a.position, limit: a.limit ?? 25 })),
);

server.registerTool(
  'list_available_players',
  {
    title: 'All available players',
    description: 'Free agents and waiver players together, each tagged with its ownership status.',
    inputSchema: { ...leagueArg, position: z.string().optional(), limit: z.number().int().min(1).max(200).optional() },
  },
  tool(async (a: { leagueKey?: string; position?: string; limit?: number }) =>
    getAvailablePlayers(a.leagueKey, { position: a.position, limit: a.limit ?? 50 })),
);

server.registerTool(
  'get_players',
  {
    title: 'Look up players',
    description: 'Fetch specific players by Yahoo player key, with ownership and rostered percentage.',
    inputSchema: { ...leagueArg, playerKeys: z.array(z.string()).min(1).max(100) },
  },
  tool(async (a: { leagueKey?: string; playerKeys: string[] }) => getPlayersByKeys(a.leagueKey, a.playerKeys)),
);

server.registerTool(
  'get_player_stats',
  {
    title: 'Player stats and fantasy points',
    description: 'Stats for players over a window, scored under this league\'s rules.',
    inputSchema: {
      ...leagueArg,
      playerKeys: z.array(z.string()).min(1).max(100),
      type: z.enum(['season', 'week', 'lastweek', 'lastmonth', 'average_season']).optional(),
      week: z.number().int().optional(),
      explain: z.boolean().optional().describe('Include a per-category points breakdown.'),
    },
  },
  tool(async (a: { leagueKey?: string; playerKeys: string[]; type?: 'season' | 'week' | 'lastweek' | 'lastmonth' | 'average_season'; week?: number; explain?: boolean }) => {
    const players = await getPlayerStats(a.leagueKey, a.playerKeys, a.type ?? 'season', a.week);
    if (!a.explain) return players.map((p) => ({ ...p, stats: p.stats ? Object.fromEntries(p.stats) : undefined }));
    const settings = await getLeagueSettings(a.leagueKey);
    return players.map((p) => ({
      name: p.name,
      playerKey: p.playerKey,
      points: p.points,
      breakdown: p.stats ? explainScore(p.stats, settings) : [],
    }));
  }),
);

server.registerTool(
  'get_waiver_priority',
  {
    title: 'Waiver priority order',
    description:
      'Every team\'s waiver priority, lowest number claims first. In this league priority is the scarce resource — ' +
      'winning a claim sends you to the back of the queue.',
    inputSchema: leagueArg,
  },
  tool(async ({ leagueKey }: { leagueKey?: string }) => {
    const [order, me] = await Promise.all([getWaiverPriorities(leagueKey), getMyTeam(leagueKey)]);
    return {
      order: order.map((t) => ({ teamKey: t.teamKey, name: t.name, priority: t.waiverPriority, isMe: t.teamKey === me.teamKey })),
      myPriority: me.waiverPriority,
    };
  }),
);

server.registerTool(
  'get_transactions',
  {
    title: 'League transactions',
    description: 'Recent adds, drops, and trades. Use it to gauge which managers are actually active.',
    inputSchema: {
      ...leagueArg,
      types: z.array(z.string()).optional().describe('e.g. ["add","drop","trade"]'),
      count: z.number().int().min(1).max(100).optional(),
    },
  },
  tool(async (a: { leagueKey?: string; types?: string[]; count?: number }) =>
    getTransactions(a.leagueKey, { types: a.types, count: a.count ?? 25 })),
);

server.registerTool(
  'get_matchup',
  { title: 'Scoreboard', description: 'Matchups and scores for a week.', inputSchema: { ...leagueArg, week: z.number().int().optional() } },
  tool(async (a: { leagueKey?: string; week?: number }) => getScoreboard(a.leagueKey, a.week)),
);

server.registerTool(
  'get_standings',
  { title: 'Standings', description: 'League standings with records and points for/against.', inputSchema: leagueArg },
  tool(async ({ leagueKey }: { leagueKey?: string }) => getStandings(leagueKey)),
);

server.registerTool(
  'list_teams',
  { title: 'League teams', description: 'All teams with manager names, move counts and waiver priority.', inputSchema: leagueArg },
  tool(async ({ leagueKey }: { leagueKey?: string }) => getTeams(leagueKey)),
);

// ---------------------------------------------------------------------------
// News tools
// ---------------------------------------------------------------------------

server.registerTool(
  'get_nfl_news',
  {
    title: 'NFL news (ESPN)',
    description: 'Latest NFL news from ESPN\'s free public feed, with the players each story is tagged to.',
    inputSchema: { limit: z.number().int().min(1).max(50).optional() },
  },
  tool(async ({ limit }: { limit?: number }) => getNews(limit ?? 25)),
);

server.registerTool(
  'get_nfl_injuries',
  {
    title: 'NFL injury report (ESPN)',
    description: 'League-wide injury designations from ESPN, normalised to Yahoo-style status codes.',
    inputSchema: { team: z.string().optional().describe('Filter to one team abbreviation.') },
  },
  tool(async ({ team }: { team?: string }) => {
    const all = await getInjuries();
    return team ? all.filter((i) => i.team === team.toUpperCase()) : all;
  }),
);

// ---------------------------------------------------------------------------
// Decision tools
// ---------------------------------------------------------------------------

server.registerTool(
  'recommend_moves',
  {
    title: 'Recommend add/drop and waiver moves',
    description:
      'Full sweep: values the wire against my roster under league scoring, then decides for each candidate whether ' +
      'to add now (free agent), file a waiver claim (spending priority), or wait for the player to clear. ' +
      'Returns the plan without executing it.',
    inputSchema: { ...leagueArg, poolSize: z.number().int().min(25).max(200).optional() },
  },
  tool(async (a: { leagueKey?: string; poolSize?: number }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, poolSize: a.poolSize, force: true });
    const plan = planMoves(ctx);
    return {
      plan,
      priorityContext: {
        myPriority: ctx.waiver.myPriority,
        numTeams: ctx.waiver.numTeams,
        activeRivalPriorities: ctx.waiver.activeRivalPriorities,
        weeksRemaining: ctx.weeksRemaining,
        optionValueOfMyPriority: priorityOptionValue(ctx.waiver.myPriority, ctx.weeksRemaining, ctx.strategy),
      },
    };
  }),
);

server.registerTool(
  'evaluate_pickup',
  {
    title: 'Evaluate one pickup',
    description:
      'Should I claim this specific player, or wait and take him as a free agent? Returns the full expected-value ' +
      'comparison including the option-value cost of burning waiver priority.',
    inputSchema: {
      ...leagueArg,
      playerKey: z.string(),
      dropPlayerKey: z.string().optional().describe('Who I would drop; defaults to my worst droppable player.'),
    },
  },
  tool(async (a: { leagueKey?: string; playerKey: string; dropPlayerKey?: string }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, force: true });
    const [player] = await getPlayersByKeys(ctx.leagueKey, [a.playerKey]);
    if (!player) throw new Error(`No player found for key ${a.playerKey}`);

    const incoming = ctx.valuations.get(a.playerKey);
    const dropCandidate = a.dropPlayerKey
      ? ctx.rosterAnalysis.candidates.find((c) => c.player.playerKey === a.dropPlayerKey)
      : ctx.rosterAnalysis.droppable[0];

    const incomingPPG = incoming?.projectedPPG ?? 0;
    const outgoingPPG = dropCandidate?.valuation.projectedPPG ?? 0;
    const valueAdded = ctx.rosterAnalysis.hasOpenSpot ? incomingPPG : incomingPPG - outgoingPPG;

    const evaluation = evaluateClaim({ player, valueAdded, context: ctx.waiver, strategy: ctx.strategy });
    return {
      player: { key: player.playerKey, name: player.name, team: player.team, position: player.displayPosition, status: player.status, ownership: player.ownership, percentOwned: player.percentOwned },
      incomingValuation: incoming,
      wouldDrop: dropCandidate ? { name: dropCandidate.player.name, projectedPPG: outgoingPPG, droppable: dropCandidate.droppable, blockers: dropCandidate.blockers } : null,
      evaluation,
    };
  }),
);

server.registerTool(
  'analyse_roster',
  {
    title: 'Roster analysis',
    description: 'Who on my roster is safely droppable, who is protected and why, and where I have positional holes.',
    inputSchema: leagueArg,
  },
  tool(async ({ leagueKey }: { leagueKey?: string }) => {
    const ctx = await buildContext({ leagueKey, force: true });
    return {
      rosterSize: ctx.rosterAnalysis.rosterSize,
      maxRosterSize: ctx.rosterAnalysis.maxRosterSize,
      openSpots: ctx.rosterAnalysis.openSpots,
      positionCounts: ctx.rosterAnalysis.positionCounts,
      players: ctx.rosterAnalysis.candidates.map((c) => ({
        name: c.player.name,
        playerKey: c.player.playerKey,
        position: c.valuation.position,
        slot: c.player.selectedPosition,
        status: c.player.status,
        projectedPPG: c.valuation.projectedPPG,
        droppable: c.droppable,
        blockers: c.blockers,
      })),
    };
  }),
);

// ---------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------

server.registerTool(
  'add_drop_player',
  {
    title: 'Add and/or drop a player',
    description:
      'Execute an immediate free-agent add, optionally dropping someone in the same transaction. ' +
      'This does NOT spend waiver priority — use it only for players who have already cleared waivers.',
    inputSchema: {
      ...leagueArg,
      addPlayerKey: z.string(),
      dropPlayerKey: z.string().optional(),
    },
  },
  tool(async (a: { leagueKey?: string; addPlayerKey: string; dropPlayerKey?: string }) => {
    const team = await getMyTeam(a.leagueKey);
    const outcome = await addDrop({
      leagueKey: resolveLeagueKey(a.leagueKey),
      teamKey: team.teamKey,
      addPlayerKey: a.addPlayerKey,
      dropPlayerKey: a.dropPlayerKey,
    });
    return outcome;
  }),
);

server.registerTool(
  'drop_player',
  { title: 'Drop a player', description: 'Drop a player from my roster.', inputSchema: { ...leagueArg, playerKey: z.string() } },
  tool(async (a: { leagueKey?: string; playerKey: string }) => {
    const team = await getMyTeam(a.leagueKey);
    return dropPlayer({ leagueKey: resolveLeagueKey(a.leagueKey), teamKey: team.teamKey, playerKey: a.playerKey });
  }),
);

server.registerTool(
  'place_waiver_claim',
  {
    title: 'File a waiver claim',
    description:
      'File a claim on a player who is on waivers. In this priority league, winning the claim moves me to the back ' +
      'of the waiver queue — check evaluate_pickup first if the trade-off is not obvious.',
    inputSchema: { ...leagueArg, addPlayerKey: z.string(), dropPlayerKey: z.string().optional() },
  },
  tool(async (a: { leagueKey?: string; addPlayerKey: string; dropPlayerKey?: string }) => {
    const team = await getMyTeam(a.leagueKey);
    return placeWaiverClaim({
      leagueKey: resolveLeagueKey(a.leagueKey),
      teamKey: team.teamKey,
      addPlayerKey: a.addPlayerKey,
      dropPlayerKey: a.dropPlayerKey,
    });
  }),
);

server.registerTool(
  'cancel_waiver_claim',
  { title: 'Cancel a waiver claim', description: 'Cancel a pending claim before it processes.', inputSchema: { transactionKey: z.string() } },
  tool(async ({ transactionKey }: { transactionKey: string }) => cancelWaiverClaim(transactionKey)),
);

server.registerTool(
  'set_claim_priority',
  { title: 'Reorder a waiver claim', description: 'Change the processing order of one of my pending claims.', inputSchema: { transactionKey: z.string(), priority: z.number().int().min(1) } },
  tool(async (a: { transactionKey: string; priority: number }) => setClaimPriority(a.transactionKey, a.priority)),
);

server.registerTool(
  'set_lineup',
  {
    title: 'Set starting lineup',
    description: 'Move players between starting slots and the bench for a given week.',
    inputSchema: {
      ...leagueArg,
      week: z.number().int(),
      slots: z.array(z.object({ playerKey: z.string(), position: z.string() })).min(1),
    },
  },
  tool(async (a: { leagueKey?: string; week: number; slots: { playerKey: string; position: string }[] }) => {
    const team = await getMyTeam(a.leagueKey);
    return setLineup({ teamKey: team.teamKey, week: a.week, slots: a.slots });
  }),
);

server.registerTool(
  'execute_recommended_moves',
  {
    title: 'Execute the recommended plan',
    description:
      'Run recommend_moves and execute the result. Respects the daily transaction cap, anti-churn hold window and ' +
      'DRY_RUN. Never touches trades.',
    inputSchema: { ...leagueArg, confirm: z.literal(true).describe('Must be true; guards against accidental invocation.') },
  },
  tool(async (a: { leagueKey?: string; confirm: true }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, force: true });
    const plan = planMoves(ctx);
    if (plan.blockedBy) return { plan, executed: [], note: plan.blockedBy };
    const results = await executePlan(ctx, plan);
    return { plan, executed: results };
  }),
);

server.registerTool(
  'optimise_lineup',
  {
    title: 'Optimise the starting lineup',
    description:
      'Compute the best legal starting lineup under league scoring and report which players should move. ' +
      'Solved exactly rather than greedily, so flex slots cannot strand a dedicated slot. ' +
      'Set apply=true to actually write it. Lineup changes cost nothing and spend no waiver priority.',
    inputSchema: {
      ...leagueArg,
      week: z.number().int().optional(),
      apply: z.boolean().optional().describe('Write the lineup to Yahoo. Defaults to false (report only).'),
    },
  },
  tool(async (a: { leagueKey?: string; week?: number; apply?: boolean }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, force: true, skipRivalRosters: true });
    let lockedTeams = new Set<string>();
    try {
      lockedTeams = lockedTeamsFromGames(await getEspnScoreboard());
    } catch { /* assume nothing locked */ }

    const plan = optimiseLineup({
      roster: ctx.roster,
      valuations: ctx.valuations,
      settings: ctx.settings,
      week: a.week ?? ctx.currentWeek,
      lockedTeams,
    });

    if (!a.apply || !plan.changes.length) return { plan, applied: false };
    const outcome = await setLineup({
      teamKey: ctx.myTeam.teamKey,
      week: a.week ?? ctx.currentWeek,
      slots: changedSlotsOnly(plan),
    });
    return { plan, applied: true, outcome };
  }),
);

server.registerTool(
  'reconcile_claims',
  {
    title: 'Check how filed waiver claims resolved',
    description:
      'Determine whether each pending claim won or lost by checking where the player ended up, and re-read ' +
      'waiver priority if anything landed. Winning a claim drops you to the back of the queue, so this keeps ' +
      'every later decision from being computed against a stale priority number.',
    inputSchema: leagueArg,
  },
  tool(async ({ leagueKey }: { leagueKey?: string }) => {
    const ctx = await buildContext({ leagueKey, skipRivalRosters: true });
    return reconcileClaims({ leagueKey: ctx.leagueKey, myTeamKey: ctx.myTeam.teamKey });
  }),
);

server.registerTool(
  'get_watchlist',
  {
    title: 'Free-agent watchlist',
    description:
      'Players we deliberately declined to claim, waiting to grab them free once waivers clear. Includes when ' +
      'each clears and how many pickup attempts have been made.',
    inputSchema: {},
  },
  tool(async () => {
    const state = loadState();
    return Object.values(state.watchlist).map((e) => ({
      ...e,
      clearsAtIso: new Date(e.clearsAt).toISOString(),
      hoursUntilClear: Math.round(((e.clearsAt - Date.now()) / 3_600_000) * 10) / 10,
    }));
  }),
);

server.registerTool(
  'watch_player',
  {
    title: 'Add a player to the watchlist',
    description:
      'Track a player to pick up the moment he clears waivers, without spending priority on a claim.',
    inputSchema: {
      ...leagueArg,
      playerKey: z.string(),
      reason: z.string().optional(),
    },
  },
  tool(async (a: { leagueKey?: string; playerKey: string; reason?: string }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, skipRivalRosters: true });
    const [player] = await getPlayersByKeys(ctx.leagueKey, [a.playerKey]);
    if (!player) throw new Error(`No player found for key ${a.playerKey}`);
    const clearsAt = clearTimeFor(player, ctx.strategy.execution.waiverProcessingHour) ?? Date.now();
    addToWatchlist({
      playerKey: player.playerKey,
      playerName: player.name,
      position: player.displayPosition,
      clearsAt,
      valueAdded: ctx.valuations.get(player.playerKey)?.projectedPPG ?? 0,
      reason: a.reason ?? 'manually watchlisted',
    });
    return {
      watching: player.name,
      clearsAt: new Date(clearsAt).toISOString(),
      hoursUntilClear: hoursUntilClear(player, ctx.strategy.execution.waiverProcessingHour),
    };
  }),
);

server.registerTool(
  'unwatch_player',
  {
    title: 'Remove a player from the watchlist',
    description: 'Stop chasing a watchlisted player.',
    inputSchema: { playerKey: z.string() },
  },
  tool(async ({ playerKey }: { playerKey: string }) => {
    removeFromWatchlist(playerKey);
    return { removed: playerKey };
  }),
);

server.registerTool(
  'suggest_trades',
  {
    title: 'Generate trade ideas',
    description:
      'Find swaps that improve my starting lineup where the other manager also gains, based on positional ' +
      'surplus and need across every roster in the league. Returns ideas only — use request_trade_approval ' +
      'to escalate one to a human decision. Nothing is sent to Yahoo.',
    inputSchema: {
      ...leagueArg,
      maxIdeas: z.number().int().min(1).max(10).optional(),
      minGain: z.number().optional().describe('Minimum points per game the deal must add to my lineup.'),
    },
  },
  tool(async (a: { leagueKey?: string; maxIdeas?: number; minGain?: number }) => {
    const ctx = await buildContext({ leagueKey: a.leagueKey, force: true });
    const me = ctx.profiles.get(ctx.myTeam.teamKey);
    if (!me) throw new Error('Could not profile my own roster');
    const rivals = [...ctx.profiles.values()].filter((p) => p.teamKey !== ctx.myTeam.teamKey);

    const ideas = generateTradeIdeas({
      me, rivals, valuations: ctx.valuations, strategy: ctx.strategy,
      maxIdeas: a.maxIdeas, minGain: a.minGain,
    });
    return { ideas, note: 'Nothing has been proposed. These are analysis only.' };
  }),
);

server.registerTool(
  'get_team_profiles',
  {
    title: 'Positional strength of every team',
    description:
      'Surplus and need by position for all teams, which is what makes a trade work: a fourth good running ' +
      'back is worth far more to a manager starting a replacement-level one than to the team hoarding him.',
    inputSchema: leagueArg,
  },
  tool(async ({ leagueKey }: { leagueKey?: string }) => {
    const ctx = await buildContext({ leagueKey, force: true });
    return [...ctx.profiles.values()].map((p) => ({
      teamKey: p.teamKey,
      name: p.name,
      isMe: p.teamKey === ctx.myTeam.teamKey,
      positions: [...p.strengths.values()].map((s) => ({
        position: s.position,
        required: s.required,
        surplus: s.surplus,
        weakestStarter: s.weakestStarter,
        starters: s.starters,
        depth: s.depth,
      })),
    }));
  }),
);

// ---------------------------------------------------------------------------
// Trades — proposal only, never autonomous
// ---------------------------------------------------------------------------

server.registerTool(
  'list_pending_trades',
  { title: 'Pending trades', description: 'Trades awaiting a decision.', inputSchema: leagueArg },
  tool(async ({ leagueKey }: { leagueKey?: string }) => getPendingTrades(leagueKey)),
);

server.registerTool(
  'request_trade_approval',
  {
    title: 'Ask the human to approve a trade',
    description:
      'Files a trade idea for human approval and returns the approval id. This is the ONLY way a trade can move ' +
      'forward: nothing is sent to Yahoo until the human runs `ffm approvals approve <id>` and the resulting ' +
      'single-use token is supplied.',
    inputSchema: {
      ...leagueArg,
      theirTeamKey: z.string(),
      sendPlayerKeys: z.array(z.string()).min(1),
      receivePlayerKeys: z.array(z.string()).min(1),
      rationale: z.string().describe('Why this trade is good for me — shown to the human.'),
    },
  },
  tool(async (a: { leagueKey?: string; theirTeamKey: string; sendPlayerKeys: string[]; receivePlayerKeys: string[]; rationale: string }) => {
    const me = await getMyTeam(a.leagueKey);
    const approval = requestApproval(
      'trade',
      `Propose to ${a.theirTeamKey}: send ${a.sendPlayerKeys.join(', ')} / receive ${a.receivePlayerKeys.join(', ')}`,
      {
        leagueKey: resolveLeagueKey(a.leagueKey),
        myTeamKey: me.teamKey,
        theirTeamKey: a.theirTeamKey,
        sendPlayerKeys: a.sendPlayerKeys,
        receivePlayerKeys: a.receivePlayerKeys,
        rationale: a.rationale,
      },
    );
    return {
      approvalId: approval.id,
      status: 'awaiting human approval',
      nextStep: `Run: ffm approvals approve ${approval.id}`,
      note: 'No trade has been sent to Yahoo.',
    };
  }),
);

server.registerTool(
  'propose_trade',
  {
    title: 'Send an approved trade',
    description:
      'Sends a trade proposal to Yahoo. Requires the single-use approval token minted by `ffm approvals approve`. ' +
      'Without a valid token this fails and nothing is sent.',
    inputSchema: {
      ...leagueArg,
      theirTeamKey: z.string(),
      sendPlayerKeys: z.array(z.string()).min(1),
      receivePlayerKeys: z.array(z.string()).min(1),
      note: z.string().optional(),
      approvalToken: z.string().describe('Token from `ffm approvals approve <id>`.'),
    },
  },
  tool(async (a: { leagueKey?: string; theirTeamKey: string; sendPlayerKeys: string[]; receivePlayerKeys: string[]; note?: string; approvalToken: string }) => {
    const me = await getMyTeam(a.leagueKey);
    return proposeTrade({
      leagueKey: resolveLeagueKey(a.leagueKey),
      myTeamKey: me.teamKey,
      theirTeamKey: a.theirTeamKey,
      sendPlayerKeys: a.sendPlayerKeys,
      receivePlayerKeys: a.receivePlayerKeys,
      note: a.note,
      approvalToken: a.approvalToken,
    });
  }),
);

server.registerTool(
  'respond_to_trade',
  {
    title: 'Accept or reject a trade',
    description: 'Responds to a pending trade. Requires an approval token; never called autonomously.',
    inputSchema: {
      transactionKey: z.string(),
      action: z.enum(['accept', 'reject']),
      note: z.string().optional(),
      approvalToken: z.string(),
    },
  },
  tool(async (a: { transactionKey: string; action: 'accept' | 'reject'; note?: string; approvalToken: string }) =>
    respondToTrade(a)),
);

server.registerTool(
  'list_approvals',
  {
    title: 'Pending human approvals',
    description: 'Trade decisions waiting on the human, and the history of approved/rejected ones.',
    inputSchema: { status: z.enum(['pending', 'approved', 'rejected', 'consumed', 'expired']).optional() },
  },
  tool(async ({ status }: { status?: 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired' }) =>
    listApprovals(status).map(({ token, ...rest }) => rest)),
);

server.registerTool(
  'get_activity_log',
  {
    title: 'What have I done',
    description: 'Transactions this system has executed, with the reasoning recorded at the time.',
    inputSchema: { limit: z.number().int().min(1).max(200).optional() },
  },
  tool(async ({ limit }: { limit?: number }) => {
    const state = loadState();
    return {
      movesLast24h: movesInLastDay(state),
      pendingClaims: state.pendingClaims,
      moves: state.moves.slice(-(limit ?? 25)).reverse(),
    };
  }),
);

// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('Yahoo Fantasy MCP server ready on stdio');
}

main().catch((e) => {
  log.error('fatal', e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
