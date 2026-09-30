import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createStore } from '../src/server/store.mjs';
import { createBedrockModel } from '../src/server/model.mjs';
import { readInferenceBudget } from '../src/server/inference-budget.mjs';
import { temporaryDirectory } from './helpers.mjs';

test('preflight reads the persisted budget while the app owns the database', async () => {
  const temporary = temporaryDirectory();
  const path = join(temporary.directory, 'briefing.sqlite');
  const store = createStore(path);
  try {
    const completed = store.reserveInference(.02, {});
    store.finishInference(completed, .01, { usage: { inputTokens: 100, outputTokens: 20 } });
    const failed = store.reserveInference(.03, {});
    store.uncertainInference(failed, { errorCode: 'AccessDeniedException' });
    assert.deepEqual(readInferenceBudget(path), store.budget());
    let credentialReads = 0;
    const model = createBedrockModel({ budget: () => readInferenceBudget(path) }, {
      resolveCredentials: async () => { credentialReads++; throw new Error('Expired'); },
      send: async () => { throw new Error('Must not invoke'); }
    });
    assert.equal((await model.availability()).code, 'usage_uncertain');
    assert.equal(credentialReads, 0);
    assert.equal(store.receipts()[1].status, 'uncertain');
  } finally { store.close(); temporary.remove(); }
});

test('a new project preflight creates no state, and unreadable ledgers fail', () => {
  const temporary = temporaryDirectory();
  const path = join(temporary.directory, 'briefing.sqlite');
  try {
    assert.equal(readInferenceBudget(path).attemptedCalls, 0);
    assert.throws(() => readInferenceBudget(temporary.directory));
  } finally { temporary.remove(); }
});
