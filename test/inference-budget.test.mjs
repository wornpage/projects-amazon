import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createStore } from '../src/server/store.mjs';
import { createBedrockModel, AWS_PROFILE, AWS_REGION, MODEL_ID, PRICE_SOURCE } from '../src/server/model.mjs';
import { readInferenceBudget, inferenceBudget } from '../src/server/inference-budget.mjs';
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

const pricing = () => ({ modelId: MODEL_ID, region: AWS_REGION, source: PRICE_SOURCE,
  sha256: 'a'.repeat(64), verifiedAt: new Date().toISOString(),
  input: { usdPerToken: .000000035 }, output: { usdPerToken: .00000014 } });
function deniedAttempt(store, overrides = {}) {
  const id = store.reserveInference(.0004, { modelId: MODEL_ID, region: AWS_REGION,
    profile: AWS_PROFILE, requestBytes: 2812, pricing: pricing(), ...overrides });
  store.uncertainInference(id, { errorCode: 'AccessDeniedException', providerRequestId: 'automated-test-denial' });
  return id;
}

test('review preserves the denied attempt, holds its worst-case cost, and a new failure stops again after restart', async () => {
  const temporary = temporaryDirectory();
  const path = join(temporary.directory, 'budget.sqlite');
  let store = createStore(path);
  try {
    const id = deniedAttempt(store);
    const before = store.receipts()[0];
    const review = store.reviewInferenceDenial(id, pricing(), 'Automated test: review the denied attempt');
    assert.equal(review.heldUsd, .03);
    const { budgetReview, ...retained } = store.receipts()[0];
    assert.deepEqual(retained, before);
    assert.equal(retained.estimatedCostUsd, null);
    assert.equal(retained.status, 'uncertain');
    assert.equal(store.budget().reservedUsd, .03);
    assert.equal(store.budget().remainingUsd, .97);
    assert.equal(store.budget().completedCalls, 0);
    assert.equal(store.budget().attemptedCalls, 1);
    assert.equal(store.budget().unreviewedUncertainCalls, 0);
    assert.equal(store.budget().reviewedUncertainCalls, 1);
    assert.deepEqual(readInferenceBudget(path), store.budget());
    store.close(); store = createStore(path);
    assert.equal(store.budget().reviewedUncertainCalls, 1);
    assert.throws(() => store.reviewInferenceDenial(id, pricing(), 'Do not apply a second review'), error => error.code === 'cost_already_reviewed');
    let calls = 0;
    const model = createBedrockModel(store, {
      resolveCredentials: async () => ({ accessKeyId: 'test-only', secretAccessKey: 'test-only' }),
      ratesFetcher: async () => pricing(), send: async () => {
        calls++;
        throw Object.assign(new Error('Automated test denial'), { name: 'AccessDeniedException', $metadata: { requestId: 'test-second-denial', httpStatusCode: 403 } });
      }
    });
    await assert.rejects(model.converse({ messages: [{ role: 'user', content: [{ text: 'Test' }] }] }), error => error.code === 'provider_unavailable');
    await assert.rejects(model.converse({ messages: [] }), error => error.code === 'usage_uncertain');
    assert.equal(calls, 1);
    assert.equal(store.budget().attemptedCalls, 2);
    assert.equal(store.budget().uncertainCalls, 2);
    assert.equal(store.budget().reviewedUncertainCalls, 1);
    assert.equal(store.budget().unreviewedUncertainCalls, 1);
  } finally { store.close(); temporary.remove(); }
});

test('denial review rejects missing evidence, stale prices, and a hold exceeding the budget', () => {
  for (const overrides of [{ modelId: 'different-model' }, { pricing: {} }, { requestBytes: 50000 }]) {
    const store = createStore();
    try {
      const id = deniedAttempt(store, overrides);
      assert.throws(() => store.reviewInferenceDenial(id, pricing(), 'Review must fail with unsupported evidence'), error => error.code === 'cost_review_ineligible');
      assert.equal(store.budget().unreviewedUncertainCalls, 1);
      assert.equal(store.receipts()[0].budgetReview, undefined);
    } finally { store.close(); }
  }
  const store = createStore();
  try {
    const id = deniedAttempt(store);
    assert.throws(() => store.reviewInferenceDenial(id, { ...pricing(), verifiedAt: '2000-01-01T00:00:00Z' }, 'Stale pricing must not authorize a retry'), error => error.code === 'invalid_cost_review');
    assert.throws(() => store.reviewInferenceDenial(id, { ...pricing(), input: { usdPerToken: 1 } }, 'An excessive hold must prevent a retry'), error => error.code === 'budget_exhausted');
    assert.equal(store.budget().reservedUsd, .0004);
    assert.equal(store.budget().unreviewedUncertainCalls, 1);
  } finally { store.close(); }
});

test('review cannot reset the global 20-attempt limit or lower a historical reservation', () => {
  const store = createStore();
  try {
    for (let index = 0; index < 19; index++) {
      const id = store.reserveInference(.001, {}); store.finishInference(id, .0001, {});
    }
    const id = deniedAttempt(store);
    const cheaper = pricing(); cheaper.input.usdPerToken /= 2; cheaper.output.usdPerToken /= 2;
    store.reviewInferenceDenial(id, cheaper, 'Historical rates still govern the retained attempt');
    assert.equal(store.budget().reservedUsd, .03);
    assert.equal(store.budget().attemptedCalls, 20);
    assert.throws(() => store.reserveInference(.001, {}), error => error.code === 'budget_exhausted');
  } finally { store.close(); }
});

test('edited review amounts and altered original receipts fail the budget integrity check', () => {
  const store = createStore();
  try {
    const id = deniedAttempt(store);
    store.reviewInferenceDenial(id, pricing(), 'Retain a verifiable review for the denial');
    const { id: ignoredId, status, reservedUsd, estimatedCostUsd, createdAt, ...receipt } = store.receipts()[0];
    const row = { status, reserved_usd: reservedUsd, actual_usd: estimatedCostUsd, receipt: JSON.stringify(receipt) };
    assert.equal(inferenceBudget([row]).reviewedUncertainCalls, 1);
    const changedHold = { ...receipt, budgetReview: { ...receipt.budgetReview, heldUsd: .001 } };
    assert.throws(() => inferenceBudget([{ ...row, receipt: JSON.stringify(changedHold) }]), error => error.code === 'invalid_cost_review');
    assert.throws(() => inferenceBudget([{ ...row, receipt: JSON.stringify({ ...receipt, requestBytes: 1 }) }]), error => error.code === 'invalid_cost_review');
  } finally { store.close(); }
});
