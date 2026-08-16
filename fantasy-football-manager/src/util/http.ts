/**
 * Shared fetch helpers: timeouts, retry with exponential backoff + jitter, and
 * a token-bucket limiter so we stay well inside Yahoo's quota and stay polite
 * to ESPN's undocumented endpoints.
 */

import { logger } from './log.js';

const log = logger('http');

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 400)}`);
    this.name = 'HttpError';
  }

  /** 5xx and 429 are worth retrying; 4xx generally are not. */
  get retryable(): boolean {
    return this.status === 429 || this.status === 408 || this.status >= 500;
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  /** Label used in logs. */
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with a hard timeout and bounded retries. Returns the raw Response so
 * callers can decide how to decode (Yahoo speaks JSON-ish, writes return XML).
 */
export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 3, label = 'request', ...init } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      if (res.ok) return res;

      const body = await res.text().catch(() => '');
      const err = new HttpError(res.status, url, body);
      if (!err.retryable || attempt === retries) throw err;

      // Honour Retry-After when the server sends one.
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoffMs(attempt);
      log.warn(`${label}: ${res.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})`);
      lastErr = err;
      await sleep(backoff);
    } catch (e) {
      if (e instanceof HttpError) {
        if (!e.retryable || attempt === retries) throw e;
        lastErr = e;
      } else {
        // Network error / abort.
        if (attempt === retries) throw e;
        lastErr = e;
        const backoff = backoffMs(attempt);
        log.warn(`${label}: network error, retrying in ${backoff}ms`, String(e));
        await sleep(backoff);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 16_000);
  return base + Math.floor(Math.random() * 250); // jitter
}

/**
 * Token bucket. Yahoo does not publish a hard number, but community consensus
 * is that sustained bursts get throttled, so we default to a conservative rate
 * and let the caller widen it.
 */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  async take(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
      await sleep(Math.max(waitMs, 25));
    }
  }
}
