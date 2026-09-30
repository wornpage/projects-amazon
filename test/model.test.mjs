import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/server/store.mjs';
import { createBedrockModel, fetchRates, MODEL_ID } from '../src/server/model.mjs';

const rates = { input: { usdPerToken: .000000035 }, output: { usdPerToken: .00000014 }, verifiedAt: new Date().toISOString(), source: 'automated-test-pricing-fixture' };
const credentials = async () => ({ accessKeyId: 'automated-test-only', secretAccessKey: 'automated-test-only' });
const input = { messages: [{ role: 'user', content: [{ text: 'Hello' }] }] };
test('missing credentials is unavailable without dispatching inference or returning a canned answer', async () => {
  const store = createStore(); let called = false;
  const model = createBedrockModel(store, { resolveCredentials: async () => { throw new Error('missing'); }, send: async () => { called = true; } });
  assert.equal((await model.availability()).available, false);
  await assert.rejects(model.converse(input), error => error.code === 'aws_credentials_unavailable');
  assert.equal(called, false); assert.equal(store.budget().attemptedCalls, 0); store.close();
});
test('real provider request shape pins model, output bound and retained usage receipt', async () => {
  const store = createStore(); let request;
  const model = createBedrockModel(store, { resolveCredentials: credentials, ratesFetcher: async () => rates, send: async value => { request = value; return { usage: { inputTokens: 100, outputTokens: 20 }, stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'Hello' }] } }, $metadata: { requestId: 'test-request' } }; } });
  await model.converse({ ...input, modelId: 'unrequested-model', inferenceConfig: { maxTokens: 100000 } });
  assert.equal(request.modelId, MODEL_ID); assert.equal(request.inferenceConfig.maxTokens, 800);
  assert.equal(store.budget().completedCalls, 1); assert.equal(store.receipts()[0].providerRequestId, 'test-request'); store.close();
});
test('failed inference and absent usage stop further calls and retain the failed attempt', async () => {
  for (const send of [async () => { throw new Error('test provider failure'); }, async () => ({ output: { message: { role: 'assistant', content: [{ text: 'No usage' }] } } })]) {
    const store = createStore(); let called = 0;
    const model = createBedrockModel(store, { resolveCredentials: credentials, ratesFetcher: async () => rates, send: async value => { called++; return send(value); } });
    await assert.rejects(model.converse(input)); await assert.rejects(model.converse(input), error => error.code === 'usage_uncertain');
    assert.equal(called, 1); assert.equal(store.budget().uncertainCalls, 1); assert.equal(store.receipts().length, 1); store.close();
  }
});
test('provider denial retains diagnostic details and does not retry', async () => {
  const store = createStore(); let calls = 0;
  const denied = Object.assign(new Error('Automated test: invocation denied'), {
    name: 'AccessDeniedException', $metadata: { requestId: 'test-denied', httpStatusCode: 403 }
  });
  const model = createBedrockModel(store, { resolveCredentials: credentials,
    ratesFetcher: async () => rates, send: async () => { calls++; throw denied; } });
  await assert.rejects(model.converse(input), error => error.code === 'provider_unavailable');
  await assert.rejects(model.converse(input), error => error.code === 'usage_uncertain');
  assert.equal(calls, 1);
  const receipt = store.receipts()[0];
  assert.equal(receipt.errorCode, 'AccessDeniedException');
  assert.equal(receipt.errorMessage, denied.message);
  assert.equal(receipt.httpStatusCode, 403);
  assert.equal(receipt.providerRequestId, 'test-denied');
  store.close();
});
test('excessive context and unavailable pricing cause zero provider calls', async () => {
  const store = createStore(); let called = false;
  const model = createBedrockModel(store, { resolveCredentials: credentials, ratesFetcher: async () => { throw new Error('No current prices'); }, send: async () => { called = true; } });
  await assert.rejects(model.converse({ messages: [{ role: 'user', content: [{ text: 'x'.repeat(25000) }] }] }), error => error.code === 'context_limit');
  await assert.rejects(model.converse(input)); assert.equal(called, false); assert.equal(store.budget().attemptedCalls, 0); store.close();
});
test('pricing parser selects only regional base on-demand input/output rates', async () => {
  const product = kind => ({ attributes: { model: 'Nova Micro', regionCode: 'us-east-1', feature: 'On-demand Inference', inferenceType: kind } });
  const term = price => ({ term: { effectiveDate: '2026-09-01', priceDimensions: { dimension: { unit: '1K tokens', pricePerUnit: { USD: price } } } } });
  const document = { products: { input: product('Input tokens'), output: product('Output tokens'), cache: product('Prompt cache read input tokens') }, terms: { OnDemand: { input: term('.000035'), output: term('.00014') } } };
  const verified = await fetchRates(async () => ({ ok: true, text: async () => JSON.stringify(document) }));
  assert.equal(verified.input.usdPerToken, .000035 / 1000); assert.equal(verified.output.usdPerToken, .00014 / 1000); assert.equal(verified.sha256.length, 64);
});
