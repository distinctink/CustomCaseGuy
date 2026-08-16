/**
 * Logger.
 *
 * IMPORTANT: everything goes to stderr, never stdout. When this process runs as
 * an MCP server, stdout is the JSON-RPC transport and a stray console.log
 * corrupts the protocol stream.
 */

export type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return ORDER[raw] ?? ORDER.info;
}

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  if (ORDER[level] < threshold()) return;
  const ts = new Date().toISOString();
  const line = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  if (extra === undefined) {
    process.stderr.write(line + '\n');
    return;
  }
  let tail: string;
  try {
    tail = typeof extra === 'string' ? extra : JSON.stringify(extra);
  } catch {
    tail = String(extra);
  }
  // Keep single log lines bounded; Yahoo/ESPN payloads are enormous.
  if (tail.length > 2000) tail = tail.slice(0, 2000) + `…(+${tail.length - 2000} chars)`;
  process.stderr.write(`${line} ${tail}\n`);
}

export function logger(scope: string) {
  return {
    debug: (m: string, e?: unknown) => emit('debug', scope, m, e),
    info: (m: string, e?: unknown) => emit('info', scope, m, e),
    warn: (m: string, e?: unknown) => emit('warn', scope, m, e),
    error: (m: string, e?: unknown) => emit('error', scope, m, e),
  };
}

export type Logger = ReturnType<typeof logger>;
