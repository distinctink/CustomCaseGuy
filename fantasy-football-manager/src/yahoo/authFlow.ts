/**
 * Interactive authorisation: open Yahoo's consent screen, capture the code.
 *
 * Two capture modes, because Yahoo is picky about redirect URIs and what it
 * accepts has changed over the years:
 *
 *  - `server`  spins up a local listener on the redirect URI and catches the
 *              callback automatically. Generates a self-signed cert when the
 *              URI is https and openssl is available.
 *  - `manual`  prints the URL, you paste back whatever Yahoo redirected you to.
 *              Always works, even if the redirect host does not resolve.
 */

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { env } from '../config.js';
import { buildAuthorizeUrl, exchangeCode, type TokenSet } from './oauth.js';
import { logger } from '../util/log.js';

const log = logger('yahoo:auth');

const PAGE = (title: string, body: string) =>
  `<!doctype html><meta charset=utf-8><title>${title}</title>` +
  `<body style="font-family:system-ui;max-width:34rem;margin:4rem auto;line-height:1.5">` +
  `<h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body>`;

export type AuthMode = 'auto' | 'server' | 'manual';

export async function authorize(mode: AuthMode = 'auto'): Promise<TokenSet> {
  const state = randomBytes(16).toString('hex');
  const url = buildAuthorizeUrl(state);

  if (mode === 'manual') return manualFlow(url);

  try {
    return await serverFlow(url, state);
  } catch (e) {
    if (mode === 'server') throw e;
    log.warn('Local callback server unavailable, falling back to manual paste', String(e));
    return manualFlow(url);
  }
}

// ---------------------------------------------------------------------------
// Automatic capture
// ---------------------------------------------------------------------------

async function serverFlow(authUrl: string, expectedState: string): Promise<TokenSet> {
  const redirect = new URL(env.yahooRedirectUri);
  const port = Number(redirect.port || (redirect.protocol === 'https:' ? 443 : 80));
  const secure = redirect.protocol === 'https:';

  let tls: { key: string; cert: string } | undefined;
  if (secure) {
    tls = selfSignedCert(redirect.hostname);
    if (!tls) throw new Error('https redirect URI but openssl is not available to mint a cert');
  }

  const code = await new Promise<string>((resolve, reject) => {
    const handler = (req: { url?: string }, res: {
      writeHead: (c: number, h: Record<string, string>) => void;
      end: (b: string) => void;
    }) => {
      const parsed = new URL(req.url ?? '/', `${redirect.protocol}//${redirect.host}`);
      if (parsed.pathname !== redirect.pathname) {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end(PAGE('Not found', 'Wrong path.'));
        return;
      }
      const err = parsed.searchParams.get('error');
      const got = parsed.searchParams.get('code');
      const state = parsed.searchParams.get('state');

      if (err) {
        res.writeHead(400, { 'content-type': 'text/html' });
        res.end(PAGE('Authorisation failed', `Yahoo said: <code>${escapeHtml(err)}</code>`));
        reject(new Error(`Yahoo returned error=${err}`));
        return;
      }
      if (state !== expectedState) {
        res.writeHead(400, { 'content-type': 'text/html' });
        res.end(PAGE('State mismatch', 'Possible CSRF; nothing was stored.'));
        reject(new Error('OAuth state mismatch'));
        return;
      }
      if (!got) {
        res.writeHead(400, { 'content-type': 'text/html' });
        res.end(PAGE('No code', 'Yahoo did not send an authorisation code.'));
        reject(new Error('No code in callback'));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE('Authorised', 'You can close this tab and return to the terminal.'));
      resolve(got);
    };

    const server = tls
      ? createHttpsServer({ key: tls.key, cert: tls.cert }, handler as never)
      : createHttpServer(handler as never);

    server.on('error', reject);
    server.listen(port, () => {
      process.stderr.write(
        `\nOpen this URL to authorise:\n\n  ${authUrl}\n\n` +
          `Waiting for the callback on ${env.yahooRedirectUri} …\n` +
          (secure ? `(self-signed cert — your browser will warn once; accept it)\n` : ''),
      );
    });

    // Do not hang forever if the user wanders off.
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for the OAuth callback (5 min)'));
    }, 5 * 60_000);

    const close = () => {
      clearTimeout(timer);
      server.close();
    };
    // Close once settled, whichever way it went.
    void Promise.resolve().then(() => {
      server.once('close', () => clearTimeout(timer));
    });
    process.once('beforeExit', close);
  });

  return exchangeCode(code);
}

/** Mint a throwaway localhost cert. Returns undefined when openssl is missing. */
function selfSignedCert(host: string): { key: string; cert: string } | undefined {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(join(tmpdir(), 'ffm-cert-'));
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', keyPath, '-out', certPath,
        '-days', '30', '-subj', `/CN=${host}`,
        '-addext', `subjectAltName=DNS:${host}`,
      ],
      { stdio: 'ignore' },
    );
    return { key: readFileSync(keyPath, 'utf8'), cert: readFileSync(certPath, 'utf8') };
  } catch {
    return undefined;
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Manual capture
// ---------------------------------------------------------------------------

async function manualFlow(authUrl: string): Promise<TokenSet> {
  process.stderr.write(
    `\nOpen this URL to authorise:\n\n  ${authUrl}\n\n` +
      `After approving, Yahoo redirects to ${env.yahooRedirectUri}?code=…\n` +
      `That page may fail to load — that is fine. Copy the whole URL from the\n` +
      `address bar (or just the code) and paste it below.\n\n`,
  );
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question('Paste redirect URL or code: ')).trim();
    const code = extractCode(answer);
    if (!code) throw new Error('Could not find an authorisation code in that input');
    return await exchangeCode(code);
  } finally {
    rl.close();
  }
}

export function extractCode(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('code=')) {
    try {
      // Handles both a full URL and a bare query fragment.
      const u = new URL(trimmed.includes('://') ? trimmed : `https://x/?${trimmed.replace(/^\?/, '')}`);
      return u.searchParams.get('code') ?? undefined;
    } catch {
      return /code=([^&\s]+)/.exec(trimmed)?.[1];
    }
  }
  // A bare code: Yahoo's are short alphanumeric strings.
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : undefined;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
