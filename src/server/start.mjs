import { startServer } from './create-server.mjs';

const runtime = await startServer({ port: Number(process.env.PORT ?? 4317) });
console.log(`Projects Briefing: ${runtime.origin}`);
console.log(`Alexa+ simulation · dedicated projects-amazon AWS profile · ${runtime.store.budget().callLimit}-call / $1 inference limit`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(0); });
