import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

export function inferenceBudget(rows) {
  const completed = rows.filter(row => row.status === 'complete');
  const estimatedCostUsd = completed.reduce((sum, row) => sum + row.actual_usd, 0);
  const reservedUsd = rows.filter(row => row.status !== 'complete').reduce((sum, row) => sum + row.reserved_usd, 0);
  return {
    limitUsd: 1, callLimit: 20, attemptedCalls: rows.length,
    completedCalls: completed.length,
    uncertainCalls: rows.filter(row => row.status === 'uncertain').length,
    estimatedCostUsd, reservedUsd,
    remainingUsd: Math.max(0, 1 - estimatedCostUsd - reservedUsd)
  };
}

// The preflight can inspect the live app's WAL database without taking its writer lock.
export function readInferenceBudget(databasePath) {
  if (!existsSync(databasePath)) return inferenceBudget([]);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try { return inferenceBudget(db.prepare('SELECT * FROM inference ORDER BY rowid').all()); }
  finally { db.close(); }
}
