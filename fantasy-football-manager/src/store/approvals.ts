/**
 * Human-approval gate for trades.
 *
 * The watcher can *propose* a trade idea, but it lands here as a pending
 * request and stops. Nothing reaches Yahoo's trade endpoints until you run
 * `ffm approvals approve <id>`, which mints a single-use token bound to that
 * request. Tokens expire so a stale approval cannot be replayed weeks later.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { ROOT } from '../config.js';
import { logger } from '../util/log.js';

const log = logger('approvals');

/**
 * Resolved per call rather than captured at module load, so the path always
 * reflects the current environment and there is no hidden dependency on which
 * module happened to be imported first.
 */
function approvalsPath(): string {
  return resolve(ROOT, process.env.APPROVALS_PATH || 'data/approvals.json');
}

/** An approved token is only good for this long. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type ApprovalKind = 'trade';

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  /** Human-readable summary shown in the CLI and the alert. */
  summary: string;
  /** Structured payload the executor needs if approved. */
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired';
  approvedAt?: number;
  consumedAt?: number;
  token?: string;
  tokenExpiresAt?: number;
  rejectedReason?: string;
}

interface ApprovalFile {
  requests: ApprovalRequest[];
}

function load(): ApprovalFile {
  const path = approvalsPath();
  if (!existsSync(path)) return { requests: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ApprovalFile;
  } catch (e) {
    log.warn('approvals file unreadable, starting fresh', String(e));
    return { requests: [] };
  }
}

function save(contents: ApprovalFile): void {
  const path = approvalsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(contents, null, 2), { mode: 0o600 });
}

/** File a request for the human. Returns the id to show in the alert. */
export function requestApproval(
  kind: ApprovalKind,
  summary: string,
  payload: Record<string, unknown>,
): ApprovalRequest {
  const file = load();

  // Do not stack duplicates for the same proposal.
  const fingerprint = JSON.stringify(payload);
  const existing = file.requests.find(
    (r) => r.status === 'pending' && r.kind === kind && JSON.stringify(r.payload) === fingerprint,
  );
  if (existing) return existing;

  const req: ApprovalRequest = {
    id: randomUUID().slice(0, 8),
    kind,
    summary,
    payload,
    createdAt: Date.now(),
    status: 'pending',
  };
  file.requests.push(req);
  save(file);
  log.info(`Approval requested (${req.id}): ${summary}`);
  return req;
}

export function listApprovals(status?: ApprovalRequest['status']): ApprovalRequest[] {
  const file = load();
  expireStale(file);
  return status ? file.requests.filter((r) => r.status === status) : file.requests;
}

/** Approve a request and mint its single-use token. */
export function approve(id: string): ApprovalRequest {
  const file = load();
  const req = file.requests.find((r) => r.id === id);
  if (!req) throw new Error(`No approval request with id ${id}`);
  if (req.status === 'consumed') throw new Error(`Request ${id} was already used`);
  if (req.status === 'rejected') throw new Error(`Request ${id} was rejected`);

  req.status = 'approved';
  req.approvedAt = Date.now();
  req.token = randomBytes(24).toString('hex');
  req.tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  save(file);
  log.info(`Approved ${id}`);
  return req;
}

export function reject(id: string, reason = ''): ApprovalRequest {
  const file = load();
  const req = file.requests.find((r) => r.id === id);
  if (!req) throw new Error(`No approval request with id ${id}`);
  req.status = 'rejected';
  req.rejectedReason = reason;
  delete req.token;
  save(file);
  log.info(`Rejected ${id}${reason ? `: ${reason}` : ''}`);
  return req;
}

/**
 * Redeem a token. Returns the request on success and marks it consumed, so the
 * same approval can never authorise two trades.
 */
export function consumeApproval(token: string, kind: ApprovalKind): ApprovalRequest | undefined {
  if (!token) return undefined;
  const file = load();
  expireStale(file);
  const req = file.requests.find((r) => r.token === token && r.kind === kind);
  if (!req) {
    log.warn('Rejected an unrecognised approval token');
    return undefined;
  }
  if (req.status !== 'approved') {
    log.warn(`Approval ${req.id} is ${req.status}, not usable`);
    return undefined;
  }
  if (req.tokenExpiresAt && Date.now() > req.tokenExpiresAt) {
    req.status = 'expired';
    delete req.token;
    save(file);
    log.warn(`Approval ${req.id} expired before use`);
    return undefined;
  }
  req.status = 'consumed';
  req.consumedAt = Date.now();
  delete req.token;
  save(file);
  return req;
}

function expireStale(file: ApprovalFile): void {
  let dirty = false;
  for (const r of file.requests) {
    if (r.status === 'approved' && r.tokenExpiresAt && Date.now() > r.tokenExpiresAt) {
      r.status = 'expired';
      delete r.token;
      dirty = true;
    }
  }
  if (dirty) save(file);
}
