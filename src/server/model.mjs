import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { createHash } from 'node:crypto';
import { AppError } from './errors.mjs';

export const AWS_PROFILE = 'projects-amazon';
export const AWS_REGION = 'us-east-1';
export const MODEL_ID = 'amazon.nova-micro-v1:0';
export const PRICE_SOURCE = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json';
export const MODEL_LIMIT_SOURCE = 'https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html';
export const INPUT_TOKEN_CEILING = 128 * 1024;
const OUTPUT_TOKEN_CEILING = 800;

export async function fetchRates(fetcher = fetch) {
  const response = await fetcher(PRICE_SOURCE, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new AppError('pricing_unavailable', 'Current AWS pricing could not be verified. No inference was started.', 503);
  const text = await response.text();
  const document = JSON.parse(text);
  const rates = {};
  for (const [sku, product] of Object.entries(document.products)) {
    const attributes = product.attributes;
    if (attributes.model !== 'Nova Micro' || attributes.regionCode !== AWS_REGION || attributes.feature !== 'On-demand Inference') continue;
    const kind = attributes.inferenceType === 'Input tokens' ? 'input' : attributes.inferenceType === 'Output tokens' ? 'output' : null;
    if (!kind) continue;
    if (rates[kind]) throw new AppError('pricing_ambiguous', 'AWS pricing has multiple matching rates. No inference was started.', 503);
    const terms = Object.values(document.terms.OnDemand[sku]);
    if (terms.length !== 1) throw new AppError('pricing_ambiguous', 'AWS pricing could not be established.', 503);
    const dimensions = Object.values(terms[0].priceDimensions);
    if (dimensions.length !== 1 || dimensions[0].unit !== '1K tokens') throw new AppError('pricing_ambiguous', 'AWS token pricing units could not be established.', 503);
    const perThousand = Number(dimensions[0].pricePerUnit.USD);
    if (!Number.isFinite(perThousand) || perThousand <= 0) throw new AppError('pricing_ambiguous', 'AWS token pricing is invalid.', 503);
    rates[kind] = { usdPerToken: perThousand / 1000, sku, effectiveDate: terms[0].effectiveDate };
  }
  if (!rates.input || !rates.output) throw new AppError('pricing_unavailable', 'Both current Nova Micro token rates are required.', 503);
  return { ...rates, source: PRICE_SOURCE, sha256: createHash('sha256').update(text).digest('hex'), verifiedAt: new Date().toISOString(), modelId: MODEL_ID, region: AWS_REGION };
}

export function createBedrockModel(store, { send, resolveCredentials, ratesFetcher = fetchRates } = {}) {
  const credentials = resolveCredentials ?? fromIni({ profile: AWS_PROFILE });
  const client = send ? null : new BedrockRuntimeClient({ region: AWS_REGION, credentials, maxAttempts: 1 });
  const dispatch = send ?? (request => client.send(new ConverseCommand(request), { abortSignal: AbortSignal.timeout(30000) }));
  let rates = null;
  let ratesAt = 0;

  return {
    async availability() {
      const budget = store.budget();
      if (budget.unreviewedUncertainCalls) return { available: false, code: 'usage_uncertain', message: 'A provider attempt has unreviewed usage. Review the retained receipt and establish a conservative budget hold before another call.' };
      if (budget.attemptedCalls >= budget.callLimit || budget.remainingUsd <= 0) return { available: false, code: 'budget_exhausted', message: `The authorized ${budget.callLimit}-call / $1 inference test limit has been reached.` };
      try { await credentials(); }
      catch { return { available: false, code: 'aws_credentials_unavailable', message: 'The projects-amazon AWS sign-in is unavailable or expired. Refresh that profile, then recheck the connection.' }; }
      return { available: true, message: 'Amazon Bedrock · Nova Micro', profile: AWS_PROFILE, region: AWS_REGION, modelId: MODEL_ID };
    },
    async converse(input) {
      const availability = await this.availability();
      if (!availability.available) throw new AppError(availability.code, availability.message, 503);
      const request = { ...input, modelId: MODEL_ID, inferenceConfig: { maxTokens: OUTPUT_TOKEN_CEILING, temperature: 0 } };
      const bytes = Buffer.byteLength(JSON.stringify(request));
      if (bytes > 24000) throw new AppError('context_limit', 'This conversation exceeds the demo context limit. Start a new demo workspace.', 413);
      if (!rates || Date.now() - ratesAt > 3600000) { rates = await ratesFetcher(); ratesAt = Date.now(); }
      // Reserve the documented full context window; request bytes do not prove token count.
      const reservation = INPUT_TOKEN_CEILING * rates.input.usdPerToken + OUTPUT_TOKEN_CEILING * rates.output.usdPerToken;
      const tokenCeiling = { input: INPUT_TOKEN_CEILING, output: OUTPUT_TOKEN_CEILING, source: MODEL_LIMIT_SOURCE };
      const id = store.reserveInference(reservation, { modelId: MODEL_ID, region: AWS_REGION, profile: AWS_PROFILE, requestBytes: bytes, pricing: rates, tokenCeiling });
      let response;
      try {
        response = await dispatch(request);
        const usage = response.usage;
        if (!usage || !Number.isSafeInteger(usage.inputTokens) || !Number.isSafeInteger(usage.outputTokens) || usage.inputTokens < 0 || usage.outputTokens < 0 || usage.inputTokens > INPUT_TOKEN_CEILING || usage.outputTokens > OUTPUT_TOKEN_CEILING) throw new AppError('usage_uncertain', 'The provider did not return usable token usage within the verified limits.', 503);
        const estimatedCostUsd = usage.inputTokens * rates.input.usdPerToken + usage.outputTokens * rates.output.usdPerToken;
        store.finishInference(id, estimatedCostUsd, { usage, providerRequestId: response.$metadata?.requestId ?? null, stopReason: response.stopReason });
        return response;
      } catch (error) {
        store.uncertainInference(id, {
          errorCode: String(error.name ?? 'provider_error').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80),
          errorMessage: String(error.message ?? 'Provider request failed').slice(0, 1500),
          httpStatusCode: response?.$metadata?.httpStatusCode ?? error.$metadata?.httpStatusCode ?? null,
          providerRequestId: response?.$metadata?.requestId ?? error.$metadata?.requestId ?? null,
          reportedUsage: response?.usage ?? null
        });
        if (error instanceof AppError) throw error;
        throw new AppError('provider_unavailable', 'Amazon Bedrock could not complete the request. The attempt receipt was retained; no automatic retry was made.', 503);
      }
    },
    close() { client?.destroy(); }
  };
}
