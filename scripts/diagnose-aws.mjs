import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fromIni } from '@aws-sdk/credential-providers';
import { createStore } from '../src/server/store.mjs';
import { createBedrockModel, fetchRates, AWS_PROFILE, AWS_REGION, MODEL_ID } from '../src/server/model.mjs';

if (process.argv.length !== 4 || process.argv[2] !== '--review-denial') {
  throw new Error('Usage: node scripts/diagnose-aws.mjs --review-denial <retained-receipt-id>. Stop the app first. This reviews one denial and can make ONE charged Converse call within the existing ledger.');
}
mkdirSync(resolve('data'), { recursive: true });
const report = { startedAt: new Date().toISOString(), status: 'preflight', profile: AWS_PROFILE,
  region: AWS_REGION, modelId: MODEL_ID, reviewedReceiptId: process.argv[3], maximumNewCalls: 1,
  originalBatch: 'data/live-validation.json', maximumTotalCalls: 20, authorizedBudgetUsd: 1 };
report.originalBatchSha256 = createHash('sha256').update(readFileSync(resolve(report.originalBatch))).digest('hex');
const path = resolve(`data/access-diagnostic-${report.startedAt.replaceAll(':', '-')}.json`);
writeFileSync(path, JSON.stringify(report, null, 2), { flag: 'wx' });
let store;
let model;
let initialCalls;
try {
  store = createStore(resolve('data/briefing.sqlite'));
  initialCalls = store.budget().attemptedCalls;
  report.startingCalls = initialCalls;
  const credentials = fromIni({ profile: AWS_PROFILE });
  await credentials();
  const pricing = await fetchRates();
  report.costReview = store.reviewInferenceDenial(process.argv[3], pricing,
    'Owner-requested review of the blocked diagnostic. Retain the denied attempt and reserve the full documented context in both directions at the higher historical/current rates, rounded up to a cent. Actual usage remains unknown.');
  model = createBedrockModel(store, { resolveCredentials: credentials });
  const response = await model.converse({ messages: [{ role: 'user', content: [{ text: 'Reply with OK.' }] }] });
  report.status = 'passed';
  report.usage = response.usage;
  report.text = response.output?.message?.content?.filter(block => block.text).map(block => block.text).join('\n').slice(0, 2000);
} catch (error) {
  report.status = 'failed';
  report.failure = { code: error.code ?? error.name, message: String(error.message).slice(0, 1500) };
  process.exitCode = 1;
} finally {
  try {
    if (store && initialCalls !== undefined) {
      report.budget = store.budget();
      report.newCalls = report.budget.attemptedCalls - initialCalls;
      report.newReceipts = store.receipts().slice(initialCalls);
    }
  } catch (error) { report.auditFailure = String(error.message).slice(0, 1500); process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  try { writeFileSync(path, JSON.stringify(report, null, 2)); }
  finally { model?.close(); store?.close(); }
  console.log(JSON.stringify({ path, status: report.status, failure: report.failure, newCalls: report.newCalls,
    budget: report.budget, providerError: report.newReceipts?.at(-1)?.errorMessage }, null, 2));
}
