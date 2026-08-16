/**
 * Notifications.
 *
 * Trades are the one thing this system will not do on its own, so the alert
 * path has to actually reach you. Console always; a webhook (Slack, Discord,
 * Make.com, ntfy — anything that accepts a JSON POST) when configured; and an
 * append-only log file as the durable fallback.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env, ROOT } from '../config.js';
import { request } from '../util/http.js';
import { logger } from '../util/log.js';

const log = logger('notify');

const ALERT_LOG = resolve(ROOT, process.env.ALERT_LOG_PATH || 'data/alerts.log');

export type Severity = 'info' | 'action' | 'approval';

export interface Alert {
  severity: Severity;
  title: string;
  body: string;
  /** Set for approval alerts so you can act on them from the CLI. */
  approvalId?: string;
}

export async function notify(alert: Alert): Promise<void> {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${alert.severity.toUpperCase()} ${alert.title}\n${alert.body}\n` +
    (alert.approvalId ? `Approve with: ffm approvals approve ${alert.approvalId}\n` : '') +
    '---\n';

  process.stderr.write(`\n${line}`);

  try {
    mkdirSync(dirname(ALERT_LOG), { recursive: true });
    appendFileSync(ALERT_LOG, line);
  } catch (e) {
    log.warn('could not write alert log', String(e));
  }

  if (!env.notifyWebhook) return;
  try {
    await request(env.notifyWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` is what Slack/Discord/ntfy read; the rest is there for anything
      // that wants the structured version.
      body: JSON.stringify({
        text: `*${alert.title}*\n${alert.body}` +
          (alert.approvalId ? `\n\nApprove: \`ffm approvals approve ${alert.approvalId}\`` : ''),
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        approvalId: alert.approvalId,
        timestamp: stamp,
      }),
      label: 'notify:webhook',
      retries: 2,
      timeoutMs: 10_000,
    });
  } catch (e) {
    // A failed webhook must never take the watcher down.
    log.warn('notification webhook failed', String(e));
  }
}
