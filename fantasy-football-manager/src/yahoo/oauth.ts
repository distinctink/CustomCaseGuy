/**
 * Yahoo OAuth 2.0 — token storage, exchange and refresh.
 *
 * Yahoo access tokens live for 3600s. Refresh tokens are long-lived but Yahoo
 * will invalidate them if you revoke the app or change the password, in which
 * case the only fix is re-running `npm run auth`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config.js';
import { request } from '../util/http.js';
import { logger } from '../util/log.js';

const log = logger('yahoo:oauth');

export const AUTHORIZE_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
export const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

/**
 * Fantasy Sports scope. `fspt-w` is read+write and is what this project needs
 * (add/drop, waiver claims, lineup changes). `fspt-r` would be read-only.
 */
export const SCOPE = 'fspt-w';

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Unix ms when the access token stops being valid. */
  expires_at: number;
  /** Yahoo's opaque user id; handy for sanity-checking which account is bound. */
  xoauth_yahoo_guid?: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  xoauth_yahoo_guid?: string;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function saveTokens(tokens: TokenSet, path = env.tokenPath): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort on platforms without POSIX modes */
  }
}

export function loadTokens(path = env.tokenPath): TokenSet | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TokenSet;
  } catch (e) {
    log.warn(`Token file at ${path} is unreadable; re-authorisation needed`, String(e));
    return undefined;
  }
}

export function hasTokens(path = env.tokenPath): boolean {
  return loadTokens(path) !== undefined;
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

/** Step 1: the URL you open in a browser to grant access. */
export function buildAuthorizeUrl(state: string): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('client_id', env.yahooClientId);
  u.searchParams.set('redirect_uri', env.yahooRedirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('state', state);
  u.searchParams.set('language', 'en-us');
  return u.toString();
}

function basicAuthHeader(): string {
  const raw = `${env.yahooClientId}:${env.yahooClientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

async function tokenRequest(body: URLSearchParams, label: string): Promise<TokenSet> {
  const res = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    label,
    // A failed refresh should surface fast rather than retry into a wall.
    retries: 2,
  });
  const raw = (await res.json()) as RawTokenResponse;
  if (!raw.access_token) throw new Error(`Yahoo returned no access_token: ${JSON.stringify(raw)}`);
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    token_type: raw.token_type ?? 'bearer',
    // Shave 60s so we refresh before the edge rather than racing it.
    expires_at: Date.now() + (raw.expires_in ?? 3600) * 1000 - 60_000,
    xoauth_yahoo_guid: raw.xoauth_yahoo_guid,
  };
}

/** Step 2: swap the ?code= from the redirect for a token pair. */
export async function exchangeCode(code: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: env.yahooRedirectUri,
    code,
  });
  const tokens = await tokenRequest(body, 'oauth:exchange');
  saveTokens(tokens);
  log.info('Authorisation complete; tokens stored');
  return tokens;
}

export async function refreshTokens(existing: TokenSet): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    redirect_uri: env.yahooRedirectUri,
    refresh_token: existing.refresh_token,
  });
  const tokens = await tokenRequest(body, 'oauth:refresh');
  // Yahoo usually returns the same refresh token; keep the old one if absent.
  if (!tokens.refresh_token) tokens.refresh_token = existing.refresh_token;
  saveTokens(tokens);
  log.debug('Access token refreshed');
  return tokens;
}

// Collapse concurrent refreshes — the watcher and MCP server can both notice
// expiry in the same tick, and Yahoo does not love duplicate refreshes.
let inflight: Promise<TokenSet> | undefined;

/** Returns a valid access token, refreshing if needed. */
export async function getAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('Not authorised with Yahoo yet. Run: npm run auth');
  }
  if (Date.now() < tokens.expires_at) return tokens.access_token;

  if (!inflight) {
    inflight = refreshTokens(tokens).finally(() => {
      inflight = undefined;
    });
  }
  const refreshed = await inflight;
  return refreshed.access_token;
}

/** Force a refresh regardless of expiry (used after a surprise 401). */
export async function forceRefresh(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new Error('Not authorised with Yahoo yet. Run: npm run auth');
  if (!inflight) {
    inflight = refreshTokens(tokens).finally(() => {
      inflight = undefined;
    });
  }
  return (await inflight).access_token;
}
