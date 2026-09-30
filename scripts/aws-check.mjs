import { resolve } from 'node:path';
import { readInferenceBudget } from '../src/server/inference-budget.mjs';
import { createBedrockModel, fetchRates } from '../src/server/model.mjs';

const databasePath = resolve('data/briefing.sqlite');
const store = { budget: () => readInferenceBudget(databasePath) };
const model = createBedrockModel(store);
try {
  const availability = await model.availability();
  console.log(JSON.stringify({ ...availability, budget: store.budget(), inferenceCallsMade: 0 }, null, 2));
  if (!availability.available) process.exitCode = 2;
  else {
    const rates = await fetchRates();
    console.log(JSON.stringify({ inputUsdPerMillionTokens: rates.input.usdPerToken * 1000000, outputUsdPerMillionTokens: rates.output.usdPerToken * 1000000, verifiedAt: rates.verifiedAt, source: rates.source, inferenceCallsMade: 0 }, null, 2));
  }
} finally { model.close(); }
