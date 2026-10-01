import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createStore } from '../src/server/store.mjs';
import { temporaryDirectory } from './helpers.mjs';
import { DatabaseSync } from 'node:sqlite';

const changes = { nextAction: 'Review the approved welcome copy with Jordan.' };
test('six seeded items have explicit stable count denominators', () => {
  const store = createStore();
  const id = store.createSession();
  assert.deepEqual(store.briefing(id).counts, { total: 6, open: 5, blocked: 3, ready: 2 });
  assert.equal(store.briefing(id).revision, 1);
  store.close();
});
test('proposing changes no items; exact confirmation persists once without completing work', () => {
  const store = createStore(); const id = store.createSession();
  const original = store.getWorkItem(id, 'client-portal');
  const proposed = store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes });
  assert.equal(store.getWorkItem(id, 'client-portal').nextAction, original.nextAction);
  assert.equal(store.history(id).length, 0);
  assert.equal(store.confirm(id, proposed.id, 1).applied, true);
  assert.equal(store.confirm(id, proposed.id, 1).applied, false);
  assert.equal(store.history(id).length, 1);
  assert.equal(store.briefing(id).revision, 2);
  assert.equal(store.getWorkItem(id, 'client-portal').status, 'active');
  store.close();
});
test('cancellation is repeatable and changes no work item or workspace revision', () => {
  const store = createStore(); const id = store.createSession();
  const before = store.briefing(id);
  const proposed = store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes });
  store.cancel(id, proposed.id); store.cancel(id, proposed.id);
  assert.deepEqual(store.briefing(id), before);
  assert.throws(() => store.confirm(id, proposed.id, 1), error => error.code === 'proposal_cancelled');
  store.close();
});
test('a newer confirmed decision makes an older proposal stale', () => {
  const store = createStore(); const id = store.createSession();
  const first = store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes });
  const second = store.propose(id, { itemId: 'sign-in', sourceRevision: 1, changes: { owner: 'Morgan' } });
  store.confirm(id, first.id, 1);
  assert.throws(() => store.confirm(id, second.id, 1), error => error.code === 'stale_revision');
  assert.equal(store.getWorkItem(id, 'sign-in').owner, 'Taylor');
  assert.throws(() => store.propose(id, { itemId: 'sign-in', sourceRevision: 1, changes }), error => error.code === 'stale_revision');
  store.close();
});
test('sessions cannot read or confirm one another’s proposals', () => {
  const store = createStore(); const first = store.createSession(); const second = store.createSession();
  const proposed = store.propose(first, { itemId: 'client-portal', sourceRevision: 1, changes });
  assert.throws(() => store.confirm(second, proposed.id, 1), error => error.code === 'proposal_not_found');
  assert.equal(store.proposals(second).length, 0);
  assert.equal(store.briefing(second).revision, 1);
  store.close();
});
test('invalid changes, no-op changes, and completed items fail without creating proposals', () => {
  const store = createStore(); const id = store.createSession();
  for (const invalid of [{ status: 'done' }, {}, { owner: '' }, { nextAction: '' }]) assert.throws(() => store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes: invalid }), error => error.code === 'invalid_proposal');
  assert.throws(() => store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Alex' } }), error => error.code === 'no_change');
  assert.throws(() => store.propose(id, { itemId: 'feedback-review', sourceRevision: 1, changes }), error => error.code === 'item_completed');
  assert.equal(store.proposals(id).length, 0);
  store.close();
});
test('saved decisions, proposals and conversations survive reopening SQLite', () => {
  const temp = temporaryDirectory(); const path = join(temp.directory, 'state.sqlite');
  let store = createStore(path); const id = store.createSession();
  const proposed = store.propose(id, { itemId: 'client-portal', sourceRevision: 1, changes });
  store.confirm(id, proposed.id, 1); store.addMessage(id, 'user', 'What changed?'); store.close();
  store = createStore(path);
  assert.equal(store.briefing(id).revision, 2);
  assert.equal(store.getWorkItem(id, 'client-portal').nextAction, changes.nextAction);
  assert.equal(store.history(id).length, 1);
  assert.equal(store.messages(id)[0].text, 'What changed?');
  store.close(); temp.remove();
});
test('usage limits are persistent and an interrupted provider reservation stops more calls', () => {
  const temp = temporaryDirectory(); const path = join(temp.directory, 'state.sqlite');
  let store = createStore(path); store.reserveInference(0.001, { purpose: 'test-interrupted-call' }); store.close();
  store = createStore(path);
  assert.equal(store.budget().uncertainCalls, 1);
  assert.throws(() => store.reserveInference(0.001, {}), error => error.code === 'usage_uncertain');
  assert.equal(store.receipts().length, 1);
  store.close(); temp.remove();
});
test('the 20-call ceiling cannot be bypassed by new workspaces', () => {
  const store = createStore();
  for (let index = 0; index < 20; index++) { const id = store.reserveInference(0.001, {}); store.finishInference(id, 0.0001, { usage: { inputTokens: 1, outputTokens: 1 } }); }
  store.createSession();
  assert.throws(() => store.reserveInference(0.001, {}), error => error.code === 'budget_exhausted');
  assert.equal(store.budget().attemptedCalls, 20); store.close();
});

test('identical pending proposals reuse a card regardless of field order, but cancelled proposals are not reused', () => {
  const store = createStore();
  try {
    const sessionId = store.createSession();
    const first = store.propose(sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan', blocker: '' } });
    const repeated = store.propose(sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { blocker: '', owner: ' Morgan ' } });
    assert.equal(repeated.id, first.id);
    assert.equal(store.proposals(sessionId).length, 1);
    assert.equal(store.briefing(sessionId).revision, 1);
    store.cancel(sessionId, first.id);
    const renewed = store.propose(sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan', blocker: '' } });
    assert.notEqual(renewed.id, first.id);
    assert.equal(store.proposals(sessionId).length, 2);
  } finally { store.close(); }
});

test('browser demo families survive restart, isolate unrelated sessions, and do not reset the budget', () => {
  const temporary = temporaryDirectory(); const path = join(temporary.directory, 'families.sqlite');
  let store = createStore(path);
  try {
    const first = store.createSession(); const second = store.createSession(first); const unrelated = store.createSession();
    const call = store.reserveInference(.001, {}); store.finishInference(call, .0001, {});
    const proposal = store.propose(first, { itemId: 'client-portal', sourceRevision: 1, changes });
    store.confirm(first, proposal.id, 1);
    store.close(); store = createStore(path);
    assert.deepEqual(store.browserSessions(second).map(value => value.id), [first, second]);
    assert.equal(store.switchBrowserSession(second, first), first);
    assert.equal(store.briefing(first).revision, 2);
    assert.throws(() => store.switchBrowserSession(unrelated, first), error => error.code === 'demo_not_owned');
    assert.equal(store.browserSessions(unrelated).length, 1);
    assert.equal(store.budget().attemptedCalls, 1);
  } finally { store.close(); temporary.remove(); }
});

test('existing session schema migrates without grouping unrelated historical demos or changing credentials', () => {
  const temporary = temporaryDirectory(); const path = join(temporary.directory, 'old.sqlite');
  const old = new DatabaseSync(path);
  old.exec('CREATE TABLE sessions (id TEXT PRIMARY KEY, browser_token TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)');
  old.prepare('INSERT INTO sessions (id, browser_token, created_at) VALUES (?, ?, ?)').run('old-first', 'first-secret', '2026-09-30');
  old.prepare('INSERT INTO sessions (id, browser_token, created_at) VALUES (?, ?, ?)').run('old-second', 'second-secret', '2026-09-30');
  old.close();
  const store = createStore(path);
  try {
    assert.equal(store.browserToken('old-first'), 'first-secret');
    assert.equal(store.browserSessions('old-first').length, 1);
    assert.throws(() => store.switchBrowserSession('old-first', 'old-second'), error => error.code === 'demo_not_owned');
    const child = store.createSession('old-first');
    assert.equal(store.switchBrowserSession(child, 'old-first'), 'old-first');
  } finally { store.close(); temporary.remove(); }
});
