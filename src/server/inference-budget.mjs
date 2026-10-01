import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AppError } from './errors.mjs';
import { AWS_PROFILE, AWS_REGION, MODEL_ID, PRICE_SOURCE, MODEL_LIMIT_SOURCE, INPUT_TOKEN_CEILING } from './model.mjs';

const REVIEW_KIND = 'nova-micro-denial-cost-bound.v1';
const digest = value => createHash('sha256').update(value).digest('hex');
function verifiedPricing(value) {
  return value?.modelId === MODEL_ID && value.region === AWS_REGION && value.source === PRICE_SOURCE &&
    /^[a-f0-9]{64}$/.test(value.sha256 ?? '') && Number.isFinite(Date.parse(value.verifiedAt)) &&
    [value.input?.usdPerToken, value.output?.usdPerToken].every(rate => Number.isFinite(rate) && rate > 0);
}
function denialHold(row, receipt, pricing) {
  if (row.status !== 'uncertain' || receipt.errorCode !== 'AccessDeniedException' ||
      !receipt.providerRequestId || receipt.modelId !== MODEL_ID || receipt.region !== AWS_REGION ||
      receipt.profile !== AWS_PROFILE || !Number.isSafeInteger(receipt.requestBytes) ||
      receipt.requestBytes <= 0 || receipt.requestBytes > 24000 ||
      !verifiedPricing(receipt.pricing) || !verifiedPricing(pricing)) {
    throw new AppError('cost_review_ineligible', 'This receipt does not establish a bounded Nova Micro denial. No inference was authorized.', 503);
  }
  const inputRate = Math.max(receipt.pricing.input.usdPerToken, pricing.input.usdPerToken);
  const outputRate = Math.max(receipt.pricing.output.usdPerToken, pricing.output.usdPerToken);
  // Hold a full context in BOTH directions, exceeding the request's output cap.
  return Math.max(row.reserved_usd, Math.ceil(INPUT_TOKEN_CEILING * (inputRate + outputRate) * 100) / 100);
}
export function createDenialCostReview(row, pricing, reason) {
  const receipt = JSON.parse(row.receipt);
  if (receipt.budgetReview) throw new AppError('cost_already_reviewed', 'This denial already has a retained cost review. It cannot authorize another diagnostic retry.', 409);
  const age = Date.now() - Date.parse(pricing?.verifiedAt);
  if (!Number.isFinite(age) || age < -60000 || age > 3600000 || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1500) {
    throw new AppError('invalid_cost_review', 'A fresh pricing snapshot and explicit review reason are required.', 503);
  }
  return { kind: REVIEW_KIND, reviewedAt: new Date().toISOString(), reason: reason.trim(),
    heldUsd: denialHold(row, receipt, pricing), pricing, modelLimitSource: MODEL_LIMIT_SOURCE,
    originalReceiptSha256: digest(row.receipt) };
}
function retainedReview(row) {
  if (row.status !== 'uncertain') return null;
  const { budgetReview, ...original } = JSON.parse(row.receipt);
  if (budgetReview === undefined) return null;
  if (!budgetReview || budgetReview.kind !== REVIEW_KIND || budgetReview.modelLimitSource !== MODEL_LIMIT_SOURCE ||
      budgetReview.originalReceiptSha256 !== digest(JSON.stringify(original)) ||
      !Number.isFinite(budgetReview.heldUsd) || budgetReview.heldUsd !== denialHold(row, original, budgetReview.pricing)) {
    throw new AppError('invalid_cost_review', 'The retained budget review failed its integrity check. No inference was authorized.', 503);
  }
  return budgetReview;
}

export function inferenceBudget(rows, authorizations = []) {
  let callLimit = 20;
  for (const authorization of authorizations) {
    if (!Number.isSafeInteger(authorization.call_limit) || authorization.call_limit <= callLimit || authorization.call_limit > 30 || authorization.limit_usd !== 1 || typeof authorization.reason !== 'string' || authorization.reason.trim().length < 10) {
      throw new AppError('invalid_authorization', 'The retained inference allowance is invalid. No call was authorized.', 503);
    }
    callLimit = authorization.call_limit;
  }
  const completed = rows.filter(row => row.status === 'complete');
  const estimatedCostUsd = completed.reduce((sum, row) => sum + row.actual_usd, 0);
  const reviewedRows = rows.map(row => ({ row, review: retainedReview(row) }));
  const reviewedUncertainCalls = reviewedRows.filter(value => value.review).length;
  const uncertainCalls = rows.filter(row => row.status === 'uncertain').length;
  const reservedUsd = reviewedRows.filter(({ row }) => row.status !== 'complete').reduce((sum, { row, review }) => sum + (review?.heldUsd ?? row.reserved_usd), 0);
  return {
    limitUsd: 1, callLimit, attemptedCalls: rows.length,
    completedCalls: completed.length,
    uncertainCalls, reviewedUncertainCalls, unreviewedUncertainCalls: uncertainCalls - reviewedUncertainCalls,
    estimatedCostUsd, reservedUsd,
    remainingUsd: Math.max(0, 1 - estimatedCostUsd - reservedUsd)
  };
}

// The preflight can inspect the live app's WAL database without taking its writer lock.
export function readInferenceBudget(databasePath) {
  if (!existsSync(databasePath)) return inferenceBudget([]);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const hasAuthorizations = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inference_authorizations'").get();
    const authorizations = hasAuthorizations ? db.prepare('SELECT * FROM inference_authorizations ORDER BY rowid').all() : [];
    return inferenceBudget(db.prepare('SELECT * FROM inference ORDER BY rowid').all(), authorizations);
  }
  finally { db.close(); }
}
