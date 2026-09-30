import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server/create-server.mjs';
import { connectMcp } from '../src/server/mcp.mjs';
import { scriptedModel } from './fixtures/scripted-model.mjs';
import { browserSession } from './helpers.mjs';

const runtime = await startServer({ port: 0, databasePath: ':memory:', modelFactory: scriptedModel });
test.after(() => runtime.close());

test('real Streamable HTTP initializes at protocol 2025-11-25', async () => {
  const session = await browserSession(runtime.origin);
  const response = await fetch(new URL('/mcp', runtime.origin), { method: 'POST', headers: { Authorization: `Bearer ${session.workspace.sessionId}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'protocol-test', version: '1.0.0' } } }) });
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.result.protocolVersion, '2025-11-25');
  assert.equal(reply.result.serverInfo.name, 'projects-briefing');
});
test('MCP negotiates a supported older version and offers the latest for an unknown version', async () => {
  const session = await browserSession(runtime.origin);
  for (const [requested, expected] of [['2025-06-18', '2025-06-18'], ['2099-01-01', '2025-11-25']]) {
    const response = await fetch(new URL('/mcp', runtime.origin), {
      method: 'POST', headers: { Authorization: `Bearer ${session.workspace.sessionId}`,
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: requested, capabilities: {}, clientInfo: { name: 'negotiation-test', version: '1.0.0' }
      } })
    });
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.equal(reply.result.protocolVersion, expected);
    assert.deepEqual(reply.result.capabilities.tools, { listChanged: true });
  }
});
test('official MCP client discovers precisely three tools and executes reads and proposals', async () => {
  const session = await browserSession(runtime.origin); const client = await connectMcp(runtime.origin, session.workspace.sessionId);
  try {
    assert.deepEqual((await client.listTools()).tools.map(value => value.name), ['get_briefing', 'get_work_item', 'propose_next_action']);
    const before = await client.callTool({ name: 'get_briefing', arguments: {} });
    assert.equal(before.structuredContent.items.length, 6);
    assert.equal(before.structuredContent.sessionId, undefined);
    const proposed = await client.callTool({ name: 'propose_next_action', arguments: { itemId: 'client-portal', sourceRevision: 1, changes: { nextAction: 'Review the welcome copy tomorrow.' } } });
    assert.equal(proposed.structuredContent.status, 'pending');
    const item = await client.callTool({ name: 'get_work_item', arguments: { itemId: 'client-portal' } });
    assert.equal(item.structuredContent.nextAction, 'Ask Jordan for the final welcome copy.');
    const confirmed = await session.post(`/api/proposals/${proposed.structuredContent.id}/confirm`, { sourceRevision: 1 });
    assert.equal(confirmed.status, 200); assert.equal(confirmed.data.applied, true);
    const repeated = await session.post(`/api/proposals/${proposed.structuredContent.id}/confirm`, { sourceRevision: 1 });
    assert.equal(repeated.data.applied, false); assert.equal(repeated.data.workspace.history.length, 1);
  } finally { await client.close(); }
});
test('malformed tool inputs and hidden confirmation tools cannot change work', async () => {
  const session = await browserSession(runtime.origin); const client = await connectMcp(runtime.origin, session.workspace.sessionId);
  try {
    const invalid = await client.callTool({ name: 'propose_next_action', arguments: { itemId: 'client-portal', sourceRevision: 1, changes: { status: 'done' } } });
    assert.equal(invalid.isError, true);
    const unavailable = await client.callTool({ name: 'confirm_action', arguments: {} });
    assert.equal(unavailable.isError, true);
    assert.equal(runtime.store.history(session.workspace.sessionId).length, 0);
  } finally { await client.close(); }
});
test('MCP rejects missing auth, malicious origin and unsupported protocol headers', async () => {
  const session = await browserSession(runtime.origin);
  const request = { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) };
  assert.equal((await fetch(new URL('/mcp', runtime.origin), request)).status, 401);
  request.headers.Authorization = `Bearer ${session.workspace.sessionId}`;
  request.headers.Origin = 'https://untrusted.example';
  assert.equal((await fetch(new URL('/mcp', runtime.origin), request)).status, 403);
  delete request.headers.Origin; request.headers['MCP-Protocol-Version'] = '2099-01-01';
  assert.equal((await fetch(new URL('/mcp', runtime.origin), request)).status, 400);
});
test('confirmation requires the matching browser session, origin and exact revision', async () => {
  const session = await browserSession(runtime.origin);
  const proposed = runtime.store.propose(session.workspace.sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan' } });
  const response = await fetch(new URL(`/api/proposals/${proposed.id}/confirm`, runtime.origin), { method: 'POST', headers: { Cookie: session.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceRevision: 1 }) });
  assert.equal(response.status, 403);
  assert.equal((await session.post(`/api/proposals/${proposed.id}/confirm`, { sourceRevision: 2 })).status, 409);
  const other = await browserSession(runtime.origin);
  assert.equal((await other.post(`/api/proposals/${proposed.id}/confirm`, { sourceRevision: 1 })).status, 404);
  assert.equal(runtime.store.getWorkItem(session.workspace.sessionId, 'client-portal').owner, 'Alex');
});
test('conversation uses real MCP calls and updated state after human confirmation', async () => {
  const session = await browserSession(runtime.origin);
  const first = await session.post('/api/chat', { message: 'What can we move forward today?' });
  assert.equal(first.status, 200); assert.match(first.data.text, /5 open items/); assert.equal(first.data.trace[0].tool, 'get_briefing');
  const proposal = await session.post('/api/chat', { message: 'Propose updating the client portal next action.' });
  assert.equal(proposal.status, 200);
  assert.deepEqual(proposal.data.trace.map(value => value.tool), ['get_briefing', 'propose_next_action']);
  const pending = proposal.data.workspace.proposals[0];
  await session.post(`/api/proposals/${pending.id}/confirm`, { sourceRevision: 1 });
  const next = await session.post('/api/chat', { message: 'What is the next action now?' });
  assert.match(next.data.text, /approved welcome copy tomorrow/); assert.match(next.data.text, /revision 2/);
});

test('an MCP bearer token cannot masquerade as the human confirmation cookie', async () => {
  const session = await browserSession(runtime.origin);
  const proposed = runtime.store.propose(session.workspace.sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan' } });
  const response = await fetch(new URL(`/api/proposals/${proposed.id}/confirm`, runtime.origin), { method: 'POST', headers: { Cookie: `pb_session=${session.workspace.sessionId}`, Origin: runtime.origin, 'X-Demo-Session': session.workspace.sessionId, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceRevision: 1 }) });
  assert.equal(response.status, 401);
  assert.equal(runtime.store.history(session.workspace.sessionId).length, 0);
});
