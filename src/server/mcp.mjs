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
  const itemId = z.enum(store.briefing(sessionId).items.map(item => item.id))
    .describe('Exact id returned by get_briefing, such as client-portal or sign-in. Never use a title or a spaced name.');
  server.registerTool('get_briefing', {
    description: 'Read the six demo work items, current workspace revision, pending proposals, and recent decision summaries. Read before proposing a change. Describing a change does not create a pending proposal.',
    inputSchema: z.strictObject({}),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  }, guarded(() => {
    const { sessionId: credential, ...briefing } = store.briefing(sessionId);
    const pendingProposals = store.proposals(sessionId).filter(value => value.status === 'pending')
      .map(({ id, itemId, sourceRevision, changes }) => ({ id, itemId, sourceRevision, changes }));
    const recentDecisions = store.history(sessionId).slice(0, 5).map(value => ({ itemId: value.itemId, revision: value.revision, createdAt: value.createdAt }));
    return { ...briefing, pendingProposals, recentDecisions };
  }));
  server.registerTool('get_work_item', {
    description: 'Inspect one work item and its saved decision history.',
    inputSchema: z.strictObject({ itemId }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  }, guarded(input => store.getWorkItem(sessionId, input.itemId)));
  server.registerTool('propose_next_action', {
    description: 'Save a proposal to change an open item owner, blocker, or nextAction. Identical pending proposals are reused. Supply sourceRevision from a fresh read. This never changes the item; only the human can confirm through the browser. Empty blocker means no recorded blocker. Status and completion cannot be changed.',
    inputSchema: proposalSchema.extend({ itemId }),
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
