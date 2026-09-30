import { connectMcp } from '../src/server/mcp.mjs';

const origin = process.env.BRIEFING_ORIGIN ?? 'http://127.0.0.1:4317';
const response = await fetch(new URL('/api/workspace', origin));
if (!response.ok) throw new Error('Start Projects Briefing before creating a client workspace.');
const workspace = await response.json();
const client = await connectMcp(origin, workspace.sessionId);
try {
  const tools = await client.listTools();
  console.log(JSON.stringify({ endpoint: new URL('/mcp', origin).href, protocolVersion: '2025-11-25', authorization: `Bearer ${workspace.sessionId}`, tools: tools.tools.map(tool => tool.name), note: 'This token selects a new fictional workspace. It is not an AWS credential.' }, null, 2));
} finally { await client.close(); }
