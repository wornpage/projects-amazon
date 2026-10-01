import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync, readFileSync, unlinkSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SEED_ITEMS } from './seed.mjs';
import { proposalSchema, parseInput } from './schemas.mjs';
import { AppError } from './errors.mjs';
import { inferenceBudget, createDenialCostReview } from './inference-budget.mjs';

export function createStore(databasePath = ':memory:') {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  let lockPath;
  if (databasePath !== ':memory:') {
    lockPath = `${resolve(databasePath)}.lock`;
    try { const fd = openSync(lockPath, 'wx'); writeFileSync(fd, JSON.stringify({ pid: process.pid, databasePath: resolve(databasePath) })); closeSync(fd); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (owner.databasePath !== resolve(databasePath) || !Number.isSafeInteger(owner.pid)) throw new AppError('invalid_database_lock', 'The database lock needs manual inspection.', 503);
      try { process.kill(owner.pid, 0); throw new AppError('database_in_use', 'This database is already open. Stop the app before running live validation.', 503); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      unlinkSync(lockPath);
      const fd = openSync(lockPath, 'wx'); writeFileSync(fd, JSON.stringify({ pid: process.pid, databasePath: resolve(databasePath) })); closeSync(fd);
    }
  }
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, browser_token TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS items (session_id TEXT NOT NULL REFERENCES sessions(id), id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(session_id, id));
    CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), item_id TEXT NOT NULL, source_revision INTEGER NOT NULL, changes TEXT NOT NULL, original TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled')), created_at TEXT NOT NULL, resolved_at TEXT);
    CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id), item_id TEXT NOT NULL, revision INTEGER NOT NULL, before_data TEXT NOT NULL, after_data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), role TEXT NOT NULL CHECK(role IN ('user','assistant','notice')), text TEXT NOT NULL, trace TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inference (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('reserved','complete','uncertain')), reserved_usd REAL NOT NULL, actual_usd REAL, receipt TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inference_authorizations (id TEXT PRIMARY KEY, call_limit INTEGER NOT NULL, limit_usd REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  if (!db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'browser_root')) {
    db.exec('BEGIN IMMEDIATE; ALTER TABLE sessions ADD COLUMN browser_root TEXT; UPDATE sessions SET browser_root = id; COMMIT;');
  }
  // A process restart cannot establish the outcome of an interrupted provider call.
  db.prepare("UPDATE inference SET status = 'uncertain' WHERE status = 'reserved'").run();

  const atomic = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const session = id => {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) throw new AppError('session_not_found', 'This demo session was not found.', 401);
    return row;
  };
  const item = (sessionId, itemId) => {
    const row = db.prepare('SELECT data FROM items WHERE session_id = ? AND id = ?').get(sessionId, itemId);
    if (!row) throw new AppError('item_not_found', 'That work item was not found in this workspace.', 404);
    return JSON.parse(row.data);
  };
  const toProposal = row => ({ id: row.id, itemId: row.item_id, sourceRevision: row.source_revision, changes: JSON.parse(row.changes), original: JSON.parse(row.original), status: row.status, createdAt: row.created_at, resolvedAt: row.resolved_at });
  const proposal = (sessionId, id) => {
    const row = db.prepare('SELECT * FROM proposals WHERE id = ? AND session_id = ?').get(id, sessionId);
    if (!row) throw new AppError('proposal_not_found', 'That proposal was not found in this workspace.', 404);
    return toProposal(row);
  };

  const store = {
    close: () => { db.close(); if (lockPath) unlinkSync(lockPath); },
    hasSession: id => Boolean(db.prepare('SELECT id FROM sessions WHERE id = ?').get(id)),
    browserToken: id => session(id).browser_token,
    sessionForBrowserToken: token => db.prepare('SELECT id FROM sessions WHERE browser_token = ?').get(token)?.id,
    createSession: parentSessionId => atomic(() => {
      const id = randomUUID();
      const root = parentSessionId === undefined ? id : session(parentSessionId).browser_root;
      db.prepare('INSERT INTO sessions (id, browser_token, created_at, browser_root) VALUES (?, ?, ?, ?)').run(id, randomBytes(32).toString('hex'), new Date().toISOString(), root);
      for (const value of SEED_ITEMS) db.prepare('INSERT INTO items VALUES (?, ?, ?)').run(id, value.id, JSON.stringify(value));
      return id;
    }),
    browserSessions: sessionId => db.prepare('SELECT id, revision, created_at FROM sessions WHERE browser_root = ? ORDER BY rowid').all(session(sessionId).browser_root)
      .map((row, index) => ({ id: row.id, label: `Demo ${index + 1}`, revision: row.revision, createdAt: row.created_at })),
    switchBrowserSession: (currentId, targetId) => {
      const current = session(currentId);
      const target = db.prepare('SELECT * FROM sessions WHERE id = ? AND browser_root = ?').get(targetId, current.browser_root);
      if (!target) throw new AppError('demo_not_owned', 'Choose a demo created by this browser.', 403);
      return target.id;
    },
    briefing: sessionId => {
      const current = session(sessionId);
      const items = db.prepare('SELECT data FROM items WHERE session_id = ? ORDER BY rowid').all(sessionId).map(row => JSON.parse(row.data));
      const open = items.filter(value => value.status !== 'done');
      return {
        sessionId, revision: current.revision, items,
        counts: { total: items.length, open: open.length, blocked: open.filter(value => value.blocker !== '').length, ready: open.filter(value => value.blocker === '').length },
        countDefinitions: { total: 'All six demo work items.', open: 'Items whose status is not done.', blocked: 'Open items with a nonempty blocker.', ready: 'Open items with no recorded blocker; this does not mean completed.' }
      };
    },
    getWorkItem: (sessionId, itemId) => ({ ...item(sessionId, itemId), revision: session(sessionId).revision, history: store.history(sessionId).filter(value => value.itemId === itemId) }),
    proposals: sessionId => db.prepare('SELECT * FROM proposals WHERE session_id = ? ORDER BY rowid DESC').all(sessionId).map(toProposal),
    history: sessionId => db.prepare('SELECT * FROM decisions WHERE session_id = ? ORDER BY rowid DESC').all(sessionId).map(row => ({ id: row.id, proposalId: row.proposal_id, itemId: row.item_id, revision: row.revision, before: JSON.parse(row.before_data), after: JSON.parse(row.after_data), createdAt: row.created_at })),
    propose: (sessionId, input) => atomic(() => {
      const parsed = parseInput(proposalSchema, input);
      if (!parsed) throw new AppError('invalid_proposal', 'Choose an item, its current revision, and an owner, blocker, or next-action change.');
      const current = session(sessionId);
      if (current.revision !== parsed.sourceRevision) throw new AppError('stale_revision', 'The workspace changed. Read it again before proposing an action.', 409);
      const original = item(sessionId, parsed.itemId);
      if (original.status === 'done') throw new AppError('item_completed', 'This item is already complete. Choose an open item.');
      if (!Object.entries(parsed.changes).some(([key, value]) => original[key] !== value)) throw new AppError('no_change', 'The proposed values are already current.');
      const canonical = value => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
      const matching = db.prepare("SELECT * FROM proposals WHERE session_id = ? AND item_id = ? AND source_revision = ? AND status = 'pending'").all(sessionId, parsed.itemId, parsed.sourceRevision)
        .find(row => canonical(JSON.parse(row.changes)) === canonical(parsed.changes));
      if (matching) return toProposal(matching);
      const id = randomUUID();
      db.prepare("INSERT INTO proposals VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL)").run(id, sessionId, parsed.itemId, parsed.sourceRevision, JSON.stringify(parsed.changes), JSON.stringify(original), new Date().toISOString());
      return proposal(sessionId, id);
    }),
    confirm: (sessionId, id, sourceRevision) => atomic(() => {
      const proposed = proposal(sessionId, id);
      if (proposed.sourceRevision !== sourceRevision) throw new AppError('proposal_mismatch', 'Confirm the exact displayed proposal revision.', 409);
      if (proposed.status === 'confirmed') return { proposal: proposed, revision: session(sessionId).revision, applied: false };
      if (proposed.status !== 'pending') throw new AppError('proposal_cancelled', 'This proposal was cancelled.', 409);
      const current = session(sessionId);
      if (current.revision !== sourceRevision) throw new AppError('stale_revision', 'The workspace changed. Ask for a fresh proposal before confirming.', 409);
      const before = item(sessionId, proposed.itemId);
      const after = { ...before, ...proposed.changes };
      const revision = current.revision + 1;
      const now = new Date().toISOString();
      db.prepare('UPDATE items SET data = ? WHERE session_id = ? AND id = ?').run(JSON.stringify(after), sessionId, proposed.itemId);
      db.prepare('UPDATE sessions SET revision = ? WHERE id = ?').run(revision, sessionId);
      db.prepare("UPDATE proposals SET status = 'confirmed', resolved_at = ? WHERE id = ?").run(now, id);
      db.prepare('INSERT INTO decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), sessionId, id, proposed.itemId, revision, JSON.stringify(before), JSON.stringify(after), now);
      return { proposal: proposal(sessionId, id), revision, applied: true };
    }),
    cancel: (sessionId, id) => atomic(() => {
      const proposed = proposal(sessionId, id);
      if (proposed.status === 'confirmed') throw new AppError('already_confirmed', 'This decision has already been saved.', 409);
      if (proposed.status === 'pending') db.prepare("UPDATE proposals SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      return proposal(sessionId, id);
    }),
    messages: sessionId => db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY seq').all(sessionId).map(row => ({ id: row.seq, role: row.role, text: row.text, trace: JSON.parse(row.trace), createdAt: row.created_at })),
    addMessage: (sessionId, role, text, trace = []) => {
      session(sessionId);
      db.prepare('INSERT INTO messages (session_id, role, text, trace, created_at) VALUES (?, ?, ?, ?, ?)').run(sessionId, role, text, JSON.stringify(trace), new Date().toISOString());
    },
    authorizations: () => db.prepare('SELECT * FROM inference_authorizations ORDER BY rowid').all(),
    budget: () => inferenceBudget(db.prepare('SELECT * FROM inference ORDER BY rowid').all(), store.authorizations()),
    extendInferenceAllowance: (callLimit, reason) => atomic(() => {
      if (!Number.isSafeInteger(callLimit) || callLimit <= store.budget().callLimit || callLimit > 30 || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1500) {
        throw new AppError('invalid_authorization', 'Record an explicit owner-approved extension up to 30 total calls. The $1 cap is unchanged.');
      }
      const record = { id: randomUUID(), call_limit: callLimit, limit_usd: 1, reason: reason.trim(), created_at: new Date().toISOString() };
      db.prepare('INSERT INTO inference_authorizations VALUES (?, ?, ?, ?, ?)').run(record.id, record.call_limit, record.limit_usd, record.reason, record.created_at);
      return record;
    }),
    reserveInference: (reservedUsd, receipt) => atomic(() => {
      const budget = store.budget();
      if (budget.unreviewedUncertainCalls > 0) throw new AppError('usage_uncertain', 'A previous provider attempt has unreviewed usage. Establish its budget hold before another live call.', 503);
      if (db.prepare("SELECT id FROM inference WHERE status = 'reserved'").get()) throw new AppError('inference_busy', 'A live inference call is already in progress.', 409);
      if (budget.attemptedCalls >= budget.callLimit || reservedUsd > budget.remainingUsd) throw new AppError('budget_exhausted', 'The authorized inference test limit has been reached.', 503);
      if (!Number.isFinite(reservedUsd) || reservedUsd <= 0) throw new AppError('invalid_cost', 'A verified positive cost reservation is required.', 503);
      const id = randomUUID();
      db.prepare("INSERT INTO inference VALUES (?, 'reserved', ?, NULL, ?, ?)").run(id, reservedUsd, JSON.stringify(receipt), new Date().toISOString());
      return id;
    }),
    finishInference: (id, actualUsd, receipt) => {
      const original = db.prepare("SELECT * FROM inference WHERE id = ? AND status = 'reserved'").get(id);
      if (!original) throw new AppError('receipt_not_found', 'The provider reservation could not be established.', 503);
      if (!Number.isFinite(actualUsd) || actualUsd < 0 || actualUsd > original.reserved_usd) {
        store.uncertainInference(id, { ...receipt, reason: 'Usage exceeded the conservative reservation or was invalid.' });
        throw new AppError('usage_uncertain', 'Provider usage could not be reconciled with its reservation.', 503);
      }
      db.prepare("UPDATE inference SET status = 'complete', actual_usd = ?, receipt = ? WHERE id = ?").run(actualUsd, JSON.stringify({ ...JSON.parse(original.receipt), ...receipt }), id);
    },
    uncertainInference: (id, receipt) => {
      const original = db.prepare('SELECT receipt FROM inference WHERE id = ?').get(id);
      if (original) db.prepare("UPDATE inference SET status = 'uncertain', receipt = ? WHERE id = ?").run(JSON.stringify({ ...JSON.parse(original.receipt), ...receipt }), id);
    },
    reviewInferenceDenial: (id, pricing, reason) => atomic(() => {
      const row = db.prepare('SELECT * FROM inference WHERE id = ?').get(id);
      if (!row) throw new AppError('receipt_not_found', 'The retained provider attempt was not found.', 404);
      const budgetReview = createDenialCostReview(row, pricing, reason);
      const budget = store.budget();
      if (budget.estimatedCostUsd + budget.reservedUsd - row.reserved_usd + budgetReview.heldUsd > budget.limitUsd) {
        throw new AppError('budget_exhausted', 'The conservative hold would exhaust the authorized budget. No retry was authorized.', 503);
      }
      // Retain the status, original reservation, and all original receipt fields.
      db.prepare('UPDATE inference SET receipt = ? WHERE id = ?').run(JSON.stringify({ ...JSON.parse(row.receipt), budgetReview }), id);
      return budgetReview;
    }),
    receipts: () => db.prepare('SELECT * FROM inference ORDER BY rowid').all().map(row => ({ id: row.id, status: row.status, reservedUsd: row.reserved_usd, estimatedCostUsd: row.actual_usd, createdAt: row.created_at, ...JSON.parse(row.receipt) }))
  };
  return store;
}
