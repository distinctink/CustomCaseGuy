/**
 * Player identity resolution between ESPN and Yahoo.
 *
 * The two sources disagree constantly: "A.J. Brown" vs "AJ Brown",
 * "Patrick Mahomes II" vs "Patrick Mahomes", "Ja'Marr" vs "JaMarr", plus
 * different team abbreviations. Getting this wrong means acting on the wrong
 * player, so matching is deliberately conservative: exact-ish first, fuzzy only
 * with a team agreement and a tight edit-distance bound.
 */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** ESPN abbreviation -> Yahoo abbreviation, where they differ. */
const TEAM_ALIASES: Record<string, string> = {
  WSH: 'WAS',
  JAC: 'JAX',
  LAR: 'LAR',
  LA: 'LAR',
  LV: 'LV',
  OAK: 'LV',
  SD: 'LAC',
  STL: 'LAR',
  ARZ: 'ARI',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
};

export function normalizeTeam(abbr: string | undefined | null): string {
  if (!abbr) return '';
  const up = abbr.trim().toUpperCase();
  return TEAM_ALIASES[up] ?? up;
}

/**
 * Canonical form of a player name: lowercase, no diacritics, no punctuation,
 * no generational suffix.
 */
export function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  const stripped = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const parts = stripped.split(' ').filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1]!)) parts.pop();
  return parts.join(' ');
}

/** "first last" -> a compact key that survives initial-style differences. */
export function initialKey(name: string): string {
  const parts = normalizeName(name).split(' ').filter(Boolean);
  if (parts.length < 2) return parts.join('');
  const last = parts[parts.length - 1]!;
  const first = parts[0]!;
  return `${first[0]}${last}`;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

export interface Nameable {
  name: string;
  team?: string;
  /** Position abbreviation, used as a tiebreaker. */
  position?: string;
}

export interface MatchResult<T> {
  value: T;
  /** 1.0 exact, down to ~0.6 for a fuzzy hit. */
  confidence: number;
  method: 'exact' | 'exact-team' | 'initial' | 'fuzzy';
}

/**
 * Find the candidate that best matches `query`.
 *
 * Returns undefined rather than guessing when nothing clears the bar — the
 * caller should skip the news item rather than act on a coin flip.
 */
export function matchPlayer<T extends Nameable>(
  query: Nameable,
  candidates: readonly T[],
  minConfidence = 0.82,
): MatchResult<T> | undefined {
  const qName = normalizeName(query.name);
  if (!qName) return undefined;
  const qTeam = normalizeTeam(query.team);
  const qPos = (query.position ?? '').toUpperCase();

  const scored: MatchResult<T>[] = [];

  for (const c of candidates) {
    const cName = normalizeName(c.name);
    if (!cName) continue;
    const cTeam = normalizeTeam(c.team);
    const teamAgrees = !qTeam || !cTeam || qTeam === cTeam;
    const posAgrees = !qPos || !c.position || positionsCompatible(qPos, c.position);

    if (cName === qName) {
      // Same name on a different team is usually a different player.
      const confidence = teamAgrees ? (qTeam && cTeam ? 1 : 0.93) : 0.55;
      scored.push({ value: c, confidence, method: teamAgrees && qTeam ? 'exact-team' : 'exact' });
      continue;
    }

    if (!teamAgrees || !posAgrees) continue;

    if (initialKey(query.name) === initialKey(c.name)) {
      scored.push({ value: c, confidence: 0.88, method: 'initial' });
      continue;
    }

    const distance = levenshtein(qName, cName);
    const longest = Math.max(qName.length, cName.length);
    const similarity = 1 - distance / longest;
    // Only trust fuzzy matches that are genuinely close and share a surname.
    if (similarity >= 0.85 && sameLastName(qName, cName)) {
      scored.push({ value: c, confidence: 0.6 + (similarity - 0.85) * 2, method: 'fuzzy' });
    }
  }

  if (!scored.length) return undefined;
  scored.sort((a, b) => b.confidence - a.confidence);
  const best = scored[0]!;

  // Ambiguity guard: two near-equal candidates means we cannot be sure.
  const runnerUp = scored[1];
  if (runnerUp && best.confidence - runnerUp.confidence < 0.05) return undefined;

  return best.confidence >= minConfidence ? best : undefined;
}

function sameLastName(a: string, b: string): boolean {
  const la = a.split(' ').pop();
  const lb = b.split(' ').pop();
  return !!la && la === lb;
}

/** DST/DEF and flex labels vary between sources. */
function positionsCompatible(a: string, b: string): boolean {
  const canon = (p: string) => {
    const up = p.toUpperCase();
    if (up === 'DST' || up === 'D/ST' || up === 'DEF') return 'DEF';
    if (up === 'PK') return 'K';
    if (up === 'FB') return 'RB';
    return up;
  };
  const ca = canon(a);
  const cb = canon(b);
  if (ca === cb) return true;
  // Yahoo's display_position can be multi-position ("RB,WR").
  return cb.split(',').map(canon).includes(ca) || ca.split(',').map(canon).includes(cb);
}
