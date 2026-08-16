/**
 * ESPN's public, undocumented NFL endpoints. No key, no cost.
 *
 * These are not contractually stable — ESPN can change a field name without
 * notice. Every reader here is defensive (optional chaining, no assumptions
 * about array presence) and `ffm doctor` probes each endpoint so a breakage
 * shows up as a clear diagnostic instead of a silent no-op watcher.
 */

import { request, RateLimiter } from '../util/http.js';
import { normalizeTeam } from '../util/names.js';
import { logger } from '../util/log.js';
import type { NewsItem, InjuryRecord, DepthChartEntry, GameInfo, TeamInfo, EspnAthleteRef } from './types.js';

const log = logger('espn');

export const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
export const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
export const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl';

/** Polite: ESPN is doing us a favour by leaving these open. */
const limiter = new RateLimiter(6, 3);

async function getJson<T>(url: string, label: string): Promise<T> {
  await limiter.take();
  const res = await request(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ffm/0.1 (personal fantasy tool)' },
    label,
    timeoutMs: 12_000,
  });
  return (await res.json()) as T;
}

type Any = Record<string, any>;

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

/**
 * League-wide news feed. `limit` maxes out around 50 in practice.
 *
 * The useful part is `categories`: ESPN tags each story with the athletes and
 * teams it concerns, which is what lets us map a headline to a Yahoo player
 * without parsing prose.
 */
export async function getNews(limit = 50): Promise<NewsItem[]> {
  const data = await getJson<Any>(`${SITE}/news?limit=${limit}`, 'espn:news');
  const articles: Any[] = Array.isArray(data?.articles) ? data.articles : [];

  return articles.map((a): NewsItem => {
    const athletes: EspnAthleteRef[] = [];
    const teams: string[] = [];

    for (const c of Array.isArray(a?.categories) ? a.categories : []) {
      if (c?.type === 'athlete' && c?.athlete?.id !== undefined) {
        athletes.push({
          id: String(c.athlete.id),
          name: String(c.athlete.description ?? c.athlete.displayName ?? ''),
          position: c.athlete?.position?.abbreviation,
          team: normalizeTeam(c.athlete?.team?.abbreviation),
        });
      }
      if (c?.type === 'team' && c?.team?.abbreviation) {
        teams.push(normalizeTeam(c.team.abbreviation));
      }
    }

    const published = String(a?.published ?? a?.lastModified ?? '');
    return {
      id: String(a?.id ?? a?.dataSourceIdentifier ?? `${a?.headline}-${published}`),
      headline: String(a?.headline ?? ''),
      description: String(a?.description ?? ''),
      published,
      publishedMs: Date.parse(published) || 0,
      type: String(a?.type ?? ''),
      link: a?.links?.web?.href,
      athletes: athletes.filter((x) => x.name),
      teams: [...new Set(teams)],
    };
  });
}

/** Per-player news, useful once we know which player we care about. */
export async function getAthleteNews(athleteId: string, limit = 10): Promise<NewsItem[]> {
  const data = await getJson<Any>(
    `${WEB}/athletes/${athleteId}/news?limit=${limit}`,
    'espn:athleteNews',
  );
  const items: Any[] = Array.isArray(data?.articles) ? data.articles : Array.isArray(data?.items) ? data.items : [];
  return items.map((a): NewsItem => {
    const published = String(a?.published ?? a?.lastModified ?? '');
    return {
      id: String(a?.id ?? `${athleteId}-${published}`),
      headline: String(a?.headline ?? ''),
      description: String(a?.description ?? ''),
      published,
      publishedMs: Date.parse(published) || 0,
      type: String(a?.type ?? ''),
      link: a?.links?.web?.href,
      athletes: [{ id: athleteId, name: '' }],
      teams: [],
    };
  });
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

/** Map ESPN's prose status onto the short codes Yahoo and our config use. */
export function injuryCode(status: string | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (!s || s === 'active') return '';
  if (s.includes('injured reserve') || s === 'ir') return 'IR';
  if (s.includes('physically unable') || s === 'pup') return 'PUP';
  // ESPN uses both "Suspension" and "Suspended"; match the common stem.
  if (s.includes('suspen')) return 'SUSP';
  if (s.includes('out')) return 'O';
  if (s.includes('doubtful')) return 'D';
  if (s.includes('questionable')) return 'Q';
  if (s.includes('probable')) return 'P';
  if (s.includes('day-to-day') || s.includes('day to day')) return 'Q';
  return '';
}

/**
 * League-wide injury table, grouped by team in ESPN's response and flattened
 * here. This is the highest-signal feed for our purposes — a status change
 * from Questionable to Out is exactly the trigger we act on.
 */
export async function getInjuries(): Promise<InjuryRecord[]> {
  const data = await getJson<Any>(`${SITE}/injuries`, 'espn:injuries');
  const groups: Any[] = Array.isArray(data?.injuries) ? data.injuries : [];
  const out: InjuryRecord[] = [];

  for (const group of groups) {
    const groupTeam = normalizeTeam(group?.abbreviation ?? group?.team?.abbreviation);
    const rows: Any[] = Array.isArray(group?.injuries) ? group.injuries : [];
    for (const r of rows) {
      const athlete = r?.athlete ?? {};
      const date = r?.date ? String(r.date) : undefined;
      const status = String(r?.status ?? r?.type?.description ?? '');
      out.push({
        id: String(r?.id ?? `${athlete?.id}-${status}-${date ?? ''}`),
        athleteId: String(athlete?.id ?? ''),
        name: String(athlete?.displayName ?? athlete?.fullName ?? ''),
        position: String(athlete?.position?.abbreviation ?? ''),
        team: normalizeTeam(athlete?.team?.abbreviation) || groupTeam,
        status,
        code: injuryCode(status),
        detail: String(r?.longComment ?? r?.shortComment ?? r?.details?.type ?? ''),
        date,
        dateMs: date ? Date.parse(date) || undefined : undefined,
        type: r?.type?.name ? String(r.type.name) : undefined,
      });
    }
  }
  return out.filter((r) => r.name);
}

// ---------------------------------------------------------------------------
// Depth charts
// ---------------------------------------------------------------------------

const athleteNameCache = new Map<string, { name: string; position: string }>();

async function resolveAthlete(ref: string): Promise<{ name: string; position: string } | undefined> {
  const id = /athletes\/(\d+)/.exec(ref)?.[1];
  if (!id) return undefined;
  const cached = athleteNameCache.get(id);
  if (cached) return cached;
  try {
    const data = await getJson<Any>(ref.replace(/^http:/, 'https:'), 'espn:athlete');
    const value = {
      name: String(data?.displayName ?? data?.fullName ?? ''),
      position: String(data?.position?.abbreviation ?? ''),
    };
    athleteNameCache.set(id, value);
    return value;
  } catch (e) {
    log.debug(`could not resolve athlete ref ${ref}`, String(e));
    return undefined;
  }
}

/**
 * Depth chart for one team. The core API returns athlete `$ref` links rather
 * than names, so this fans out one request per player and caches the results —
 * call it only for teams a news item actually implicates.
 */
export async function getDepthChart(
  espnTeamId: string,
  season: number,
  teamAbbr = '',
): Promise<DepthChartEntry[]> {
  const data = await getJson<Any>(
    `${CORE}/seasons/${season}/teams/${espnTeamId}/depthcharts`,
    'espn:depthchart',
  );
  const items: Any[] = Array.isArray(data?.items) ? data.items : [];
  const out: DepthChartEntry[] = [];

  for (const formation of items) {
    const positions = formation?.positions ?? {};
    for (const key of Object.keys(positions)) {
      const slot = positions[key];
      const posAbbr = String(slot?.position?.abbreviation ?? key).toUpperCase();
      const athletes: Any[] = Array.isArray(slot?.athletes) ? slot.athletes : [];
      for (const a of athletes) {
        const ref = a?.athlete?.$ref;
        if (!ref) continue;
        const resolved = await resolveAthlete(String(ref));
        if (!resolved?.name) continue;
        out.push({
          athleteId: String(/athletes\/(\d+)/.exec(String(ref))?.[1] ?? ''),
          name: resolved.name,
          rank: Number(a?.rank ?? a?.slot ?? 99),
          team: normalizeTeam(teamAbbr),
          position: resolved.position || posAbbr,
        });
      }
    }
  }
  // Keep the best (lowest) rank per player across formations.
  const best = new Map<string, DepthChartEntry>();
  for (const e of out) {
    const prev = best.get(e.name);
    if (!prev || e.rank < prev.rank) best.set(e.name, e);
  }
  return [...best.values()];
}

// ---------------------------------------------------------------------------
// Games and teams
// ---------------------------------------------------------------------------

export async function getScoreboard(week?: number, season?: number): Promise<GameInfo[]> {
  const qs = new URLSearchParams();
  if (week) qs.set('week', String(week));
  if (season) qs.set('dates', String(season));
  const url = `${SITE}/scoreboard${qs.toString() ? `?${qs}` : ''}`;
  const data = await getJson<Any>(url, 'espn:scoreboard');
  const events: Any[] = Array.isArray(data?.events) ? data.events : [];

  return events.map((e): GameInfo => {
    const comp = Array.isArray(e?.competitions) ? e.competitions[0] : undefined;
    const competitors: Any[] = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const date = String(e?.date ?? '');
    return {
      id: String(e?.id ?? ''),
      name: String(e?.name ?? ''),
      shortName: String(e?.shortName ?? ''),
      date,
      dateMs: Date.parse(date) || 0,
      state: String(comp?.status?.type?.state ?? e?.status?.type?.state ?? ''),
      statusDetail: String(comp?.status?.type?.detail ?? ''),
      week: data?.week?.number ? Number(data.week.number) : undefined,
      competitors: competitors.map((c) => ({
        team: normalizeTeam(c?.team?.abbreviation),
        homeAway: String(c?.homeAway ?? ''),
        score: Number(c?.score ?? 0),
      })),
    };
  });
}

export async function getTeams(): Promise<TeamInfo[]> {
  const data = await getJson<Any>(`${SITE}/teams`, 'espn:teams');
  const groups: Any[] = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return groups
    .map((t) => t?.team)
    .filter(Boolean)
    .map((t: Any): TeamInfo => ({
      id: String(t?.id ?? ''),
      abbreviation: normalizeTeam(t?.abbreviation),
      displayName: String(t?.displayName ?? ''),
    }));
}

let teamIndex: Map<string, TeamInfo> | undefined;

/** abbreviation -> ESPN team, cached for the process lifetime. */
export async function teamByAbbr(abbr: string): Promise<TeamInfo | undefined> {
  if (!teamIndex) {
    const teams = await getTeams();
    teamIndex = new Map(teams.map((t) => [t.abbreviation, t]));
  }
  return teamIndex.get(normalizeTeam(abbr));
}
