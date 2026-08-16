/**
 * Authenticated transport for the Yahoo Fantasy Sports API.
 *
 * Reads are JSON (`?format=json`). Writes are XML — Yahoo's transaction and
 * roster endpoints reject JSON bodies, so `post`/`put` take an XML string.
 */

import { XMLParser } from 'fast-xml-parser';
import { getAccessToken, forceRefresh } from './oauth.js';
import { request, RateLimiter, HttpError } from '../util/http.js';
import { logger } from '../util/log.js';

const log = logger('yahoo:client');

export const BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

/**
 * Yahoo publishes no hard rate limit but throttles sustained bursts. ~4 req/s
 * with a small burst allowance keeps us comfortably clear while still letting
 * the watcher pull a free-agent page set quickly when news breaks.
 */
const limiter = new RateLimiter(8, 4);

const xml = new XMLParser({ ignoreAttributes: false, parseTagValue: true });

export interface CallOptions {
  /** Skip the JSON format param (used when we want raw XML back). */
  raw?: boolean;
  timeoutMs?: number;
}

function url(path: string, raw = false): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const sep = clean.includes('?') ? '&' : '?';
  return raw ? `${BASE}${clean}` : `${BASE}${clean}${sep}format=json`;
}

async function authHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await getAccessToken()}`,
    Accept: 'application/json',
  };
}

/**
 * GET a Yahoo resource and return parsed JSON.
 *
 * On a 401 we refresh once and retry — Yahoo occasionally rejects a token that
 * our local clock still thinks is valid.
 */
export async function get<T = unknown>(path: string, opts: CallOptions = {}): Promise<T> {
  await limiter.take();
  const target = url(path, opts.raw);

  const attempt = async (headers: Record<string, string>) =>
    request(target, { headers, label: `GET ${path}`, timeoutMs: opts.timeoutMs ?? 20_000 });

  try {
    const res = await attempt(await authHeaders());
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      log.warn('401 from Yahoo, forcing token refresh and retrying once');
      await forceRefresh();
      const res = await attempt(await authHeaders());
      return (await res.json()) as T;
    }
    throw e;
  }
}

export interface WriteResult {
  ok: boolean;
  status: number;
  /** Parsed XML response, when Yahoo sent one. */
  body: unknown;
  raw: string;
}

async function write(method: 'POST' | 'PUT', path: string, xmlBody: string): Promise<WriteResult> {
  await limiter.take();
  const target = url(path, true);
  const headers = {
    Authorization: `Bearer ${await getAccessToken()}`,
    'Content-Type': 'application/xml',
    Accept: 'application/xml',
  };

  const send = async (h: Record<string, string>) =>
    request(target, {
      method,
      headers: h,
      body: xmlBody,
      label: `${method} ${path}`,
      timeoutMs: 25_000,
      // Writes are not idempotent — a retried add could double-submit. Only the
      // transport-level 5xx retry inside `request` applies, so keep it at 0.
      retries: 0,
    });

  try {
    const res = await send(headers);
    const raw = await res.text();
    return { ok: true, status: res.status, body: raw ? safeXml(raw) : undefined, raw };
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      log.warn('401 on write, refreshing token and retrying once');
      await forceRefresh();
      const res = await send({ ...headers, Authorization: `Bearer ${await getAccessToken()}` });
      const raw = await res.text();
      return { ok: true, status: res.status, body: raw ? safeXml(raw) : undefined, raw };
    }
    if (e instanceof HttpError) {
      // Yahoo puts the useful reason in an XML error body.
      throw new Error(`Yahoo ${method} ${path} failed (${e.status}): ${describeError(e.body)}`);
    }
    throw e;
  }
}

export const post = (path: string, xmlBody: string) => write('POST', path, xmlBody);
export const put = (path: string, xmlBody: string) => write('PUT', path, xmlBody);

function safeXml(raw: string): unknown {
  try {
    return xml.parse(raw);
  } catch {
    return raw;
  }
}

/** Yahoo error bodies look like <error><description>…</description></error>. */
export function describeError(body: string): string {
  try {
    const parsed = xml.parse(body) as { error?: { description?: string } };
    const desc = parsed?.error?.description;
    if (typeof desc === 'string' && desc.trim()) return desc.trim();
  } catch {
    /* fall through */
  }
  return body.slice(0, 500) || '(empty body)';
}

/** Escape a value for inclusion in an XML document. */
export function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  );
}
