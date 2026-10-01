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
    assert.deepEqual(before.structuredContent.pendingProposals, []);
    assert.deepEqual(before.structuredContent.recentDecisions, []);
    const proposed = await client.callTool({ name: 'propose_next_action', arguments: { itemId: 'client-portal', sourceRevision: 1, changes: { nextAction: 'Review the welcome copy tomorrow.' } } });
    assert.equal(proposed.structuredContent.status, 'pending');
    const item = await client.callTool({ name: 'get_work_item', arguments: { itemId: 'client-portal' } });
    assert.equal(item.structuredContent.nextAction, 'Ask Jordan for the final welcome copy.');
    const pendingRead = await client.callTool({ name: 'get_briefing', arguments: {} });
    assert.deepEqual(pendingRead.structuredContent.pendingProposals, [{ id: proposed.structuredContent.id, itemId: 'client-portal', sourceRevision: 1, changes: { nextAction: 'Review the welcome copy tomorrow.' } }]);
    const confirmed = await session.post(`/api/proposals/${proposed.structuredContent.id}/confirm`, { sourceRevision: 1 });
    assert.equal(confirmed.status, 200); assert.equal(confirmed.data.applied, true);
    const repeated = await session.post(`/api/proposals/${proposed.structuredContent.id}/confirm`, { sourceRevision: 1 });
    assert.equal(repeated.data.applied, false); assert.equal(repeated.data.workspace.history.length, 1);
    const savedRead = await client.callTool({ name: 'get_briefing', arguments: {} });
    assert.deepEqual(savedRead.structuredContent.pendingProposals, []);
    assert.equal(savedRead.structuredContent.recentDecisions.length, 1);
    assert.equal(savedRead.structuredContent.recentDecisions[0].revision, 2);
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
    const tools = (await client.listTools()).tools;
    for (const name of ['get_work_item', 'propose_next_action']) {
      const schema = tools.find(tool => tool.name === name).inputSchema.properties.itemId;
      assert.ok(schema.enum.includes('client-portal'));
      assert.equal(schema.enum.includes('client portal'), false);
    }
    const invalidId = await client.callTool({ name: 'get_work_item', arguments: { itemId: 'client portal' } });
    assert.equal(invalidId.isError, true);
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

test('every turn forces a fresh briefing before a model can jump directly to proposing', async () => {
  const choices = [];
  const local = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => ({
    availability: async () => ({ available: true }), close() {},
    async converse({ messages, toolConfig }) {
      choices.push(toolConfig.toolChoice);
      const result = messages.at(-1).content.find(part => part.toolResult);
      if (result) return { stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: `Observed revision ${result.toolResult.content[0].json.revision}.` }] } } };
      const name = toolConfig.toolChoice?.tool?.name ?? 'propose_next_action';
      return { stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: {
        toolUseId: `test-forced-${choices.length}`, name,
        input: name === 'get_briefing' ? {} : { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Unreviewed' } }
      } }] } } };
    }
  }) });
  try {
    const session = await browserSession(local.origin);
    const first = await session.post('/api/chat', { message: 'Read the workspace.' });
    assert.equal(first.status, 200);
    assert.equal(first.data.trace[0].result.revision, 1);
    const proposal = local.store.propose(session.workspace.sessionId, { itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan' } });
    assert.equal((await session.post(`/api/proposals/${proposal.id}/confirm`, { sourceRevision: 1 })).status, 200);
    const second = await session.post('/api/chat', { message: 'Continue working.' });
    assert.equal(second.status, 200);
    assert.equal(second.data.trace[0].result.revision, 2);
    assert.deepEqual(choices, [{ tool: { name: 'get_briefing' } }, { auto: {} }, { tool: { name: 'get_briefing' } }, { auto: {} }]);
    assert.equal(local.store.getWorkItem(session.workspace.sessionId, 'client-portal').owner, 'Morgan');
  } finally { await local.close(); }
});

test('a conversation cannot spend the final call when its mandatory read leaves no allowance for a reply', async () => {
  let dispatched = 0;
  const local = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => ({
    availability: async () => ({ available: true }), close() {},
    async converse() { dispatched++; throw new Error('An incomplete turn must not start'); }
  }) });
  try {
    for (let index = 0; index < 19; index++) {
      const id = local.store.reserveInference(.001, {});
      local.store.finishInference(id, .0001, {});
    }
    const session = await browserSession(local.origin);
    assert.equal(session.workspace.model.available, false);
    assert.equal(session.workspace.model.code, 'conversation_budget_exhausted');
    const response = await session.post('/api/chat', { message: 'Read the workspace.' });
    assert.equal(response.status, 503);
    assert.equal(response.data.error.code, 'conversation_budget_exhausted');
    assert.equal(local.store.budget().attemptedCalls, 19);
    assert.equal(local.store.messages(session.workspace.sessionId).length, 0);
    assert.equal(dispatched, 0);
  } finally { await local.close(); }
});

test('a saved MCP proposal completes the turn without a model-generated confirmation or third call', async () => {
  let calls = 0;
  const local = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => {
    const fixture = scriptedModel();
    return { ...fixture, async converse(input) {
      if (++calls > 2) throw new Error('A saved proposal must not spend a third call');
      return fixture.converse(input);
    } };
  } });
  try {
    const session = await browserSession(local.origin);
    const response = await session.post('/api/chat', { message: 'Propose updating the client portal next action.' });
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    const pending = response.data.workspace.proposals[0];
    assert.equal(pending.status, 'pending');
    assert.equal(response.data.trace.at(-1).result.id, pending.id);
    assert.equal(response.data.text, `Prepared a change for “${pending.original.title}”.\nReview the proposed values in the change card. Work stays unchanged until you confirm.`);
    assert.equal(local.store.getWorkItem(session.workspace.sessionId, 'client-portal').nextAction, pending.original.nextAction);
    assert.equal(local.store.history(session.workspace.sessionId).length, 0);
  } finally { await local.close(); }
});

test('planning text is excluded from new replies and model history while old retained messages are preserved', async () => {
  const inputs = [];
  const local = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => {
    const fixture = scriptedModel();
    return { ...fixture, async converse(input) {
      inputs.push(input);
      const response = await fixture.converse(input);
      if (response.stopReason === 'end_turn') response.output.message.content = [{ text: '<thinking>NEW_PRIVATE_PLAN</thinking>The workspace is ready to review.' }];
      return response;
    } };
  } });
  try {
    const session = await browserSession(local.origin);
    const retained = '<thinking>OLD_PRIVATE_PLAN</thinking>Previous visible reply.';
    local.store.addMessage(session.workspace.sessionId, 'assistant', retained);
    const response = await session.post('/api/chat', { message: 'Read the workspace.' });
    assert.equal(response.status, 200);
    assert.equal(response.data.text, 'The workspace is ready to review.');
    assert.ok(inputs.every(input => !JSON.stringify(input.messages).includes('OLD_PRIVATE_PLAN')));
    assert.equal(local.store.messages(session.workspace.sessionId)[0].text, retained);
    assert.equal(local.store.messages(session.workspace.sessionId).at(-1).text, response.data.text);
  } finally { await local.close(); }
});

test('a planning-only model response fails without a fabricated answer or proposal', async () => {
  let calls = 0;
  const local = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => {
    const fixture = scriptedModel();
    return { ...fixture, async converse(input) {
      calls++;
      const response = await fixture.converse(input);
      if (response.stopReason === 'end_turn') response.output.message.content = [{ text: '<thinking>Unfinished planning' }];
      return response;
    } };
  } });
  try {
    const session = await browserSession(local.origin);
    const response = await session.post('/api/chat', { message: 'Read the workspace.' });
    assert.equal(response.status, 502);
    assert.equal(response.data.error.code, 'empty_model_response');
    assert.equal(calls, 2);
    assert.equal(local.store.messages(session.workspace.sessionId).filter(message => message.role === 'assistant').length, 0);
    assert.equal(local.store.proposals(session.workspace.sessionId).length, 0);
  } finally { await local.close(); }
});
