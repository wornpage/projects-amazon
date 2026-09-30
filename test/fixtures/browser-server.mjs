import { startServer } from '../../src/server/create-server.mjs';
import { scriptedModel } from './scripted-model.mjs';

// Only the automated restart test launches this fixture process.
const runtime = await startServer({ port: 0, databasePath: process.argv[2], modelFactory: scriptedModel });
console.log(JSON.stringify({ origin: runtime.origin }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await runtime.close(); process.exit(0);
});
