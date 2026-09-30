import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { proposalSchema } from './schemas.mjs';
import { publicError } from './errors.mjs';

const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const guarded = fn => async input => {
  try { return result(fn(input)); }
  catch (error) { return { ...result({ error: publicError(error) }), isError: true }; }
};

export function createMcpServer(store, sessionId) {
  const server = new McpServer({ name: 'projects-briefing', version: '0.1.0' });
  server.registerTool('get_briefing', {
    description: 'Read the six demo work items, their owners, blockers, next actions, completion criteria, and the current workspace revision. Read before proposing a change.',
    inputSchema: z.strictObject({}),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  }, guarded(() => {
    const { sessionId: credential, ...briefing } = store.briefing(sessionId);
    return briefing;
  }));
  server.registerTool('get_work_item', {
    description: 'Inspect one work item and its saved decision history.',
    inputSchema: z.strictObject({ itemId: z.string().min(1).max(80) }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  }, guarded(input => store.getWorkItem(sessionId, input.itemId)));
  server.registerTool('propose_next_action', {
    description: 'Save a proposal to change an open item owner, blocker, or nextAction. Supply sourceRevision from a fresh read. This never changes the item; only the human can confirm through the browser. Empty blocker means no recorded blocker. Status and completion cannot be changed.',
    inputSchema: proposalSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, guarded(input => store.propose(sessionId, input)));
  return server;
}

export async function handleMcp(req, res, store, sessionId) {
  const server = createMcpServer(store, sessionId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export async function connectMcp(origin, sessionId) {
  const client = new Client({ name: 'projects-briefing-conversation', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', origin), {
    requestInit: { headers: { Authorization: `Bearer ${sessionId}` } }
  });
  await client.connect(transport);
  return client;
}
