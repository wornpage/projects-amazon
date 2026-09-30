import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server/create-server.mjs';
import { connectMcp } from '../src/server/mcp.mjs';
import { scriptedModel } from './fixtures/scripted-model.mjs';
import { temporaryDirectory } from './helpers.mjs';

const runtime = await startServer({ port: 0, databasePath: ':memory:', modelFactory: scriptedModel });
const browser = await chromium.launch({ headless: true });
const output = resolve('output/playwright');
mkdirSync(output, { recursive: true });
test.after(async () => { await browser.close(); await runtime.close(); });

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(runtime.origin);
  await page.getByTestId('item-client-portal').waitFor();
  return { context, page };
}
async function chat(page, text) {
  await page.getByLabel('Message your work companion').fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}

async function startFixtureProcess(databasePath) {
  const processHandle = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/browser-server.mjs', import.meta.url)), databasePath], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; let errors = '';
  processHandle.stderr.on('data', chunk => errors += chunk);
  const origin = await new Promise((resolveOrigin, reject) => {
    const failed = code => reject(new Error(`Restart fixture exited before startup (${code}): ${errors}`));
    processHandle.once('error', reject);
    processHandle.once('exit', failed);
    processHandle.stdout.on('data', chunk => {
      output += chunk;
      if (!output.includes('\n')) return;
      processHandle.removeListener('exit', failed);
      try { resolveOrigin(JSON.parse(output.slice(0, output.indexOf('\n'))).origin); }
      catch (error) { reject(error); }
    });
  });
  return { origin, processHandle, async stop() {
    if (processHandle.exitCode !== null || processHandle.signalCode !== null) return;
    const exited = once(processHandle, 'exit');
    processHandle.kill('SIGTERM');
    await exited;
  } };
}

test('browser: briefing, proposal, confirmation, refresh, updated briefing and isolated session', async () => {
  const { context, page } = await newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const offsite = []; page.on('request', request => { if (!request.url().startsWith(runtime.origin)) offsite.push(request.url()); });
  await chat(page, 'What can we move forward today?');
  await page.getByText(/Studio launch has 5 open items/).waitFor();
  await chat(page, 'Propose updating the client portal next action.');
  await page.getByRole('button', { name: /Confirm action/ }).waitFor();
  const proposal = page.getByTestId('proposal-card');
  await proposal.getByText('1 of 3 fields changes.', { exact: true }).waitFor();
  const unchanged = proposal.getByRole('button', { name: /^(Show 2 unchanged fields|Hide unchanged fields)$/ });
  await unchanged.click();
  assert.equal(await unchanged.getAttribute('aria-expanded'), 'true');
  const previewPanel = page.locator(`[id="${await unchanged.getAttribute('aria-controls')}"]`);
  assert.match(await previewPanel.innerText(), /Owner/);
  assert.match(await previewPanel.innerText(), /Blocker/);
  await unchanged.press('Enter');
  assert.equal(await unchanged.getAttribute('aria-expanded'), 'false');
  await unchanged.press('Space');
  assert.equal(await unchanged.getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: resolve(output, 'automated-test-proposal-desktop.png'), fullPage: true });
  assert.match(await page.getByTestId('item-client-portal').innerText(), /final welcome copy/);
  await page.getByRole('button', { name: /Confirm action/ }).click();
  await page.getByText('Decision saved. The work item now shows your confirmed change.').waitFor();
  assert.match(await page.getByTestId('item-client-portal').innerText(), /approved welcome copy tomorrow/);
  assert.match(await page.getByTestId('item-client-portal').innerText(), /Waiting/);
  await page.reload(); await page.getByTestId('item-client-portal').waitFor();
  assert.match(await page.getByTestId('item-client-portal').innerText(), /approved welcome copy tomorrow/);
  await chat(page, 'What is the next action now?');
  await page.locator('.conversation-body').getByText(/Workspace revision 2/).waitFor();
  await page.getByRole('tab', { name: /^Decisions/ }).click();
  assert.match(await page.getByRole('tabpanel', { name: /^Decisions/ }).innerText(), /approved welcome copy tomorrow/);
  await page.screenshot({ path: resolve(output, 'automated-test-decisions-desktop.png'), fullPage: true });
  const other = await newPage();
  assert.match(await other.page.getByTestId('item-client-portal').innerText(), /final welcome copy/);
  await other.page.getByRole('tab', { name: /^Decisions/ }).click();
  await other.page.getByText('Your decisions will live here.').waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(offsite, []);
  await other.context.close(); await context.close();
});

test('browser: cancellation leaves the item and revision unchanged', async () => {
  const { context, page } = await newPage();
  await chat(page, 'Propose updating the client portal next action.');
  await page.getByRole('button', { name: 'Cancel proposal', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancel proposal', exact: true }).click();
  await page.getByText('Proposal cancelled. The work item is unchanged.').waitFor();
  assert.match(await page.getByTestId('item-client-portal').innerText(), /final welcome copy/);
  assert.equal(await page.getByTestId('proposal-card').count(), 0);
  assert.match(await page.locator('.workspace-label').innerText(), /revision 1/);
  await context.close();
});
test('browser: reviewed owner and blocker changes persist and update counts without completing work', async () => {
  const { context, page } = await newPage();
  try {
    const workspace = await (await page.request.get(`${runtime.origin}/api/workspace`)).json();
    const client = await connectMcp(runtime.origin, workspace.sessionId);
    try {
      await client.callTool({ name: 'propose_next_action', arguments: {
        itemId: 'client-portal', sourceRevision: 1, changes: { owner: 'Morgan', blocker: '' }
      } });
    } finally { await client.close(); }
    await page.reload();
    const proposal = page.getByTestId('proposal-card');
    await proposal.getByText('2 of 3 fields change.', { exact: true }).waitFor();
    assert.match(await proposal.innerText(), /Alex[\s\S]*Morgan/);
    assert.match(await proposal.innerText(), /Waiting for the approved welcome copy[\s\S]*No blocker recorded/);
    const originalCard = await page.getByTestId('item-client-portal').innerText();
    assert.match(originalCard, /Alex/);
    assert.match(originalCard, /Waiting/);
    await page.getByRole('button', { name: /Confirm action/ }).dblclick();
    await page.getByText('Decision saved. The work item now shows your confirmed change.').waitFor();
    await page.reload();
    const saved = await (await page.request.get(`${runtime.origin}/api/workspace`)).json();
    assert.deepEqual(saved.counts, { total: 6, open: 5, blocked: 2, ready: 3 });
    assert.equal(saved.history.length, 1);
    const card = page.getByTestId('item-client-portal');
    assert.match(await card.innerText(), /Morgan/);
    assert.match(await card.innerText(), /Ready/);
    assert.match(await card.innerText(), /Ask Jordan for the final welcome copy/);
    assert.equal(saved.items.find(item => item.id === 'client-portal').status, 'active');
    await page.getByRole('tab', { name: /^Decisions/ }).click();
    const history = page.getByRole('tabpanel', { name: /^Decisions/ });
    assert.match(await history.innerText(), /Alex[\s\S]*Morgan/);
    assert.match(await history.innerText(), /Waiting for the approved welcome copy[\s\S]*No blocker recorded/);
  } finally { await context.close(); }
});

test('browser: out-of-band confirmed change disables stale confirmation', async () => {
  const { context, page } = await newPage();
  await chat(page, 'Propose updating the client portal next action.');
  await page.getByRole('button', { name: /Confirm action/ }).waitFor();
  const workspace = await (await page.request.get(`${runtime.origin}/api/workspace`)).json();
  const client = await connectMcp(runtime.origin, workspace.sessionId);
  const second = await client.callTool({ name: 'propose_next_action', arguments: { itemId: 'sign-in', sourceRevision: 1, changes: { owner: 'Morgan' } } });
  const response = await page.request.post(`${runtime.origin}/api/proposals/${second.structuredContent.id}/confirm`, { headers: { Origin: runtime.origin, 'X-Demo-Session': workspace.sessionId }, data: { sourceRevision: 1 } });
  assert.equal(response.status(), 200);
  await client.close(); await page.reload();
  await page.getByText('The workspace changed. Ask for a fresh proposal before confirming.').waitFor();
  assert.equal(await page.getByRole('button', { name: /Confirm action/ }).isDisabled(), true);
  assert.match(await page.getByTestId('item-client-portal').innerText(), /final welcome copy/);
  await context.close();
});

test('browser: mobile layout has no overflow and details support pointer, Enter and Space', async () => {
  const { context, page } = await newPage({ width: 390, height: 844 });
  const card = page.getByTestId('item-client-portal');
  const toggle = card.getByRole('button', { name: /Blocker & completion criteria/ });
  await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await toggle.press('Enter'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.press('Space'); assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  const detailsId = await toggle.getAttribute('aria-controls');
  assert.match(await page.locator(`[id="${detailsId}"]`).innerText(), /Completion criteria/);
  const workTab = page.getByRole('tab', { name: /^Work items/ });
  const decisionsTab = page.getByRole('tab', { name: /^Decisions/ });
  await workTab.focus();
  await workTab.press('ArrowRight');
  assert.equal(await decisionsTab.getAttribute('aria-selected'), 'true');
  assert.equal(await decisionsTab.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.getByRole('tabpanel', { name: /^Decisions/ }).isVisible(), true);
  await decisionsTab.press('Home');
  assert.equal(await workTab.getAttribute('aria-selected'), 'true');
  assert.equal(await workTab.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: resolve(output, 'automated-test-mobile.png'), fullPage: true });
  await context.close();
});

test('browser: unavailable model is explicit and does not fabricate a conversation', async () => {
  const unavailable = await startServer({ port: 0, databasePath: ':memory:', modelFactory: () => ({ async availability() { return { available: false, message: 'Automated test: credentials unavailable' }; }, converse() { throw new Error('Must not be called'); } }) });
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(unavailable.origin); await page.getByText('Conversation is unavailable').waitFor();
    assert.equal(await page.getByLabel('Message your work companion').isDisabled(), true);
    assert.equal(await page.locator('.chat-message').count(), 0);
    assert.equal(unavailable.store.budget().attemptedCalls, 0);
  } finally { await context.close(); await unavailable.close(); }
});

test('browser: a confirmed decision and conversation survive an actual Node server restart', async () => {
  const temporary = temporaryDirectory();
  const databasePath = resolve(temporary.directory, 'briefing.sqlite');
  const context = await browser.newContext();
  let first; let second;
  try {
    first = await startFixtureProcess(databasePath);
    const page = await context.newPage();
    await page.goto(first.origin);
    await page.getByTestId('item-client-portal').waitFor();
    await chat(page, 'Propose updating the client portal next action.');
    await page.getByRole('button', { name: /Confirm action/ }).click();
    await page.getByText('Decision saved. The work item now shows your confirmed change.').waitFor();
    const before = await (await page.request.get(`${first.origin}/api/workspace`)).json();
    assert.equal(before.history.length, 1);
    assert.equal(before.messages.length, 2);
    await first.stop();
    assert.ok(first.processHandle.exitCode !== null || first.processHandle.signalCode !== null);
    second = await startFixtureProcess(databasePath);
    assert.notEqual(first.processHandle.pid, second.processHandle.pid);
    await page.goto(second.origin);
    await page.getByTestId('item-client-portal').waitFor();
    const after = await (await page.request.get(`${second.origin}/api/workspace`)).json();
    assert.equal(after.sessionId, before.sessionId);
    assert.equal(after.revision, 2);
    assert.deepEqual(after.history, before.history);
    assert.deepEqual(after.messages, before.messages);
    assert.match(await page.getByTestId('item-client-portal').innerText(), /approved welcome copy tomorrow/);
    await page.getByRole('tab', { name: /^Decisions/ }).click();
    assert.match(await page.getByRole('tabpanel', { name: /^Decisions/ }).innerText(), /approved welcome copy tomorrow/);
  } finally {
    await context.close();
    if (first) await first.stop();
    if (second) await second.stop();
    temporary.remove();
  }
});
