import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { loadStrategy, resetStrategyCache, DEFAULT_STRATEGY, ROOT } from '../src/config.js';

function withFile(contents: unknown, fn: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'ffm-strategy-'));
  const path = join(dir, 'strategy.json');
  writeFileSync(path, JSON.stringify(contents, null, 2));
  try {
    resetStrategyCache();
    fn(path);
  } finally {
    resetStrategyCache();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the shipped example config loads without error', () => {
  const path = resolve(ROOT, 'config/strategy.example.json');
  resetStrategyCache();
  const s = loadStrategy(path);
  resetStrategyCache();

  assert.equal(s.waiver.minValueAdded, 1.5);
  assert.equal(s.waiver.rivalPassivity, 1.4);
  assert.equal(s.execution.autoExecuteTrades, false);
  assert.ok(s.valuation.roleChangeBonus.starter_out_backup_promoted! > 0);
  assert.ok(s.positionFloors.RB! >= 1);
});

test('the example config documents every knob the code reads', () => {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'config/strategy.example.json'), 'utf8')) as Record<string, any>;

  for (const key of Object.keys(DEFAULT_STRATEGY.waiver)) {
    assert.ok(key in raw.waiver, `waiver.${key} is missing from strategy.example.json`);
  }
  for (const key of Object.keys(DEFAULT_STRATEGY.execution)) {
    assert.ok(key in raw.execution, `execution.${key} is missing from strategy.example.json`);
  }
});

test('a partial config keeps the defaults for everything it omits', () => {
  withFile({ waiver: { minValueAdded: 9 } }, (path) => {
    const s = loadStrategy(path);
    assert.equal(s.waiver.minValueAdded, 9, 'the override applies');
    assert.equal(s.waiver.priorityDecay, DEFAULT_STRATEGY.waiver.priorityDecay, 'siblings survive');
    assert.deepEqual(s.positionFloors, DEFAULT_STRATEGY.positionFloors, 'untouched sections survive');
  });
});

test('nested records merge rather than replace', () => {
  withFile({ positionFloors: { TE: 2 } }, (path) => {
    const s = loadStrategy(path);
    assert.equal(s.positionFloors.TE, 2, 'the override applies');
    assert.equal(s.positionFloors.RB, DEFAULT_STRATEGY.positionFloors.RB,
      'other positions are not wiped out by a partial override');
  });
});

test('a missing strategy file is fine — defaults are used', () => {
  resetStrategyCache();
  const s = loadStrategy(join(tmpdir(), 'definitely-not-a-real-file.json'));
  resetStrategyCache();
  assert.deepEqual(s, DEFAULT_STRATEGY);
});

test('enabling autonomous trades is rejected at load time', () => {
  withFile({ execution: { autoExecuteTrades: true } }, (path) => {
    assert.throws(() => loadStrategy(path), /alert-only/i,
      'the locked decision cannot be overridden from config');
  });
});

test('autoExecuteTrades stays false even if the key is absent', () => {
  withFile({ execution: { maxTransactionsPerDay: 10 } }, (path) => {
    const s = loadStrategy(path);
    assert.equal(s.execution.maxTransactionsPerDay, 10);
    assert.equal(s.execution.autoExecuteTrades, false);
  });
});
