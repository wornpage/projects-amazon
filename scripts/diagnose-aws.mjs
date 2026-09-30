import { BedrockRuntimeClient, CountTokensCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AWS_PROFILE, AWS_REGION, MODEL_ID } from '../src/server/model.mjs';

// AWS documents CountTokens as free. This diagnostic never invokes a model.
const client = new BedrockRuntimeClient({
  region: AWS_REGION, credentials: fromIni({ profile: AWS_PROFILE }), maxAttempts: 1
});
const receipt = {
  checkedAt: new Date().toISOString(), operation: 'CountTokens',
  profile: AWS_PROFILE, region: AWS_REGION, modelId: MODEL_ID,
  inferenceCallsMade: 0,
  pricingSource: 'https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html'
};
try {
  const result = await client.send(new CountTokensCommand({
    modelId: MODEL_ID,
    input: { converse: { messages: [{ role: 'user', content: [{ text: 'Hello' }] }] } }
  }), { abortSignal: AbortSignal.timeout(30000) });
  Object.assign(receipt, { status: 'success', inputTokens: result.inputTokens,
    providerRequestId: result.$metadata?.requestId, httpStatusCode: result.$metadata?.httpStatusCode });
} catch (error) {
  Object.assign(receipt, { status: 'failed', errorCode: error.name,
    errorMessage: String(error.message).slice(0, 1500),
    providerRequestId: error.$metadata?.requestId, httpStatusCode: error.$metadata?.httpStatusCode });
  process.exitCode = 2;
} finally {
  client.destroy();
  mkdirSync(resolve('data'), { recursive: true });
  const path = resolve('data', `aws-diagnostic-${receipt.checkedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, receiptPath: path }, null, 2));
}
