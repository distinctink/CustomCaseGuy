/**
 * Yahoo Fantasy JSON normalisation.
 *
 * Yahoo's `format=json` output is a mechanical translation of their XML, so it
 * has two shapes that no sane JSON API would use:
 *
 *  1. Collections are objects with numeric string keys plus a `count`:
 *       { "0": {player: …}, "1": {player: …}, count: 2 }
 *
 *  2. Entities are arrays whose elements are single-key objects that are meant
 *     to be merged together, and the first element is often itself such an
 *     array:
 *       player: [ [ {player_key:…}, {name:{…}} ], {selected_position:[…]} ]
 *
 * `mergeAll` collapses (2) into a plain object; `listOf` turns (1) into an
 * array. Field values are left in their raw shape so each mapper can decide —
 * some of them (eligible_positions) are genuine lists that must not be merged.
 */

export type Json = Record<string, unknown>;

/** Unwrap the `fantasy_content` envelope every Yahoo response carries. */
export function fantasyContent(body: unknown): Json {
  const root = body as { fantasy_content?: Json } | undefined;
  if (!root?.fantasy_content) throw new Error('Response has no fantasy_content envelope');
  return root.fantasy_content;
}

/**
 * Merge Yahoo's array-of-fragments into one object. Recurses into nested
 * arrays (element 0 of an entity is usually itself a fragment array) but never
 * into object values, so list-shaped fields survive intact.
 */
export function mergeAll(node: unknown): Json {
  if (node === null || node === undefined) return {};
  if (Array.isArray(node)) {
    const out: Json = {};
    for (const el of node) Object.assign(out, mergeAll(el));
    return out;
  }
  if (typeof node === 'object') return { ...(node as Json) };
  return {};
}

/**
 * Turn a Yahoo collection into an array. When `key` is given, each entry is
 * unwrapped from its single-key envelope and merged.
 *
 *   listOf(node.players, 'player') -> [ {player_key: …}, … ]
 */
export function listOf(node: unknown, key?: string): Json[] {
  if (!node || typeof node !== 'object') return [];
  const coll = node as Json;
  const out: Json[] = [];
  const declared = typeof coll.count === 'number' ? coll.count : Number(coll.count);
  const limit = Number.isFinite(declared) ? declared : Infinity;

  for (let i = 0; out.length < limit; i++) {
    const entry = coll[String(i)];
    if (entry === undefined) break;
    const inner = key ? (entry as Json)[key] : entry;
    if (inner === undefined) continue;
    out.push(mergeAll(inner));
  }
  return out;
}

/**
 * Pull the values out of a list of single-key wrappers.
 *   [{position:'WR'},{position:'W/R/T'}] -> ['WR','W/R/T']
 * Accepts a bare object or scalar too, because Yahoo is inconsistent about
 * whether a one-element list is wrapped in an array.
 */
export function pluck(node: unknown, key: string): string[] {
  if (node === null || node === undefined) return [];
  if (Array.isArray(node)) {
    return node.flatMap((el) => pluck(el, key));
  }
  if (typeof node === 'object') {
    const v = (node as Json)[key];
    return v === undefined || v === null ? [] : [String(v)];
  }
  return [String(node)];
}

/**
 * Yahoo returns some sub-entities as either an object or a one-element array
 * depending on the endpoint (transaction_data is the notorious one).
 */
export function asObject(node: unknown): Json {
  if (Array.isArray(node)) return mergeAll(node);
  if (node && typeof node === 'object') return node as Json;
  return {};
}

/** Yahoo sends numbers as strings almost everywhere. */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object') return fallback;
  return String(v);
}

/** Yahoo booleans are "1"/"0"/1/0/true. */
export function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

/**
 * Walk a merged entity array looking for the first fragment that carries `key`.
 * Used where the position of a sub-resource in the array is not guaranteed.
 */
export function findFragment(node: unknown, key: string): unknown {
  if (!Array.isArray(node)) {
    return node && typeof node === 'object' ? (node as Json)[key] : undefined;
  }
  for (const el of node) {
    if (el && typeof el === 'object' && !Array.isArray(el) && key in (el as Json)) {
      return (el as Json)[key];
    }
    if (Array.isArray(el)) {
      const nested = findFragment(el, key);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
