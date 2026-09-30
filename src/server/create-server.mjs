import express from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.mjs';
import { createBedrockModel } from './model.mjs';
import { createConversation } from './conversation.mjs';
import { handleMcp } from './mcp.mjs';
import { chatSchema, decisionSchema, parseInput } from './schemas.mjs';
import { AppError, publicError } from './errors.mjs';

export async function startServer({ port = 4317, databasePath = resolve('data/briefing.sqlite'), modelFactory = createBedrockModel, staticDirectory = resolve('dist') } = {}) {
  const store = createStore(databasePath);
  const model = modelFactory(store);
  const app = createMcpExpressApp({ host: '127.0.0.1', allowedHosts: ['127.0.0.1', 'localhost'] });
  app.disable('x-powered-by');
  let origin;
  const conversation = createConversation(store, model, () => origin);
  app.use((req, res, next) => {
    const suppliedOrigin = req.get('origin');
    const allowed = [origin, origin?.replace('127.0.0.1', 'localhost'), 'http://127.0.0.1:5173', 'http://localhost:5173'];
    if (suppliedOrigin && !allowed.includes(suppliedOrigin)) return res.status(403).json({ error: { code: 'origin_rejected', message: 'Use the local Projects Briefing app.' } });
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.post('/mcp', async (req, res, next) => {
    try {
      const token = /^Bearer ([0-9a-f-]{36})$/i.exec(req.get('authorization') ?? '')?.[1];
      if (!token || !store.hasSession(token)) throw new AppError('mcp_auth_required', 'Supply the bearer token for your demo workspace.', 401);
      await handleMcp(req, res, store, token);
    } catch (error) { next(error); }
  });
  app.all('/mcp', (req, res) => res.status(405).set('Allow', 'POST').json({ error: { code: 'method_not_allowed', message: 'This stateless Streamable HTTP endpoint accepts POST.' } }));
  app.use('/api', (req, res, next) => {
    const cookies = Object.fromEntries((req.get('cookie') ?? '').split(';').map(value => value.trim().split('=')).filter(pair => pair.length === 2));
    let sessionId = cookies.pb_session ? store.sessionForBrowserToken(cookies.pb_session) : null;
    if (req.method === 'GET' && (!sessionId || !store.hasSession(sessionId))) {
      sessionId = store.createSession();
      res.cookie('pb_session', store.browserToken(sessionId), { httpOnly: true, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
    }
    if (!sessionId || !store.hasSession(sessionId)) return next(new AppError('session_required', 'Open a demo workspace first.', 401));
    if (req.method !== 'GET') {
      if (req.get('x-demo-session') !== sessionId || !req.get('origin')) return next(new AppError('confirmation_origin_required', 'Use this workspace’s browser controls for changes.', 403));
      if (!req.is('application/json')) return next(new AppError('json_required', 'Send JSON for this request.', 415));
    }
    req.demoSession = sessionId;
    next();
  });
  const snapshot = async sessionId => ({ ...store.briefing(sessionId), proposals: store.proposals(sessionId), history: store.history(sessionId), messages: store.messages(sessionId), model: await model.availability(), budget: store.budget() });
  app.get('/api/workspace', async (req, res) => res.json(await snapshot(req.demoSession)));
  app.post('/api/chat', async (req, res) => {
    const input = parseInput(chatSchema, req.body);
    if (!input) throw new AppError('invalid_message', 'Enter a message of up to 1,500 characters.');
    const response = await conversation.run(req.demoSession, input.message);
    res.json({ ...response, workspace: await snapshot(req.demoSession) });
  });
  app.post('/api/proposals/:id/confirm', async (req, res) => {
    const input = parseInput(decisionSchema, req.body);
    if (!input) throw new AppError('invalid_confirmation', 'The displayed source revision is required.');
    const result = store.confirm(req.demoSession, req.params.id, input.sourceRevision);
    res.json({ ...result, workspace: await snapshot(req.demoSession) });
  });
  app.post('/api/proposals/:id/cancel', async (req, res) => {
    if (!req.body || Object.keys(req.body).length) throw new AppError('invalid_cancellation', 'Cancellation requires an empty JSON object.');
    store.cancel(req.demoSession, req.params.id);
    res.json({ workspace: await snapshot(req.demoSession) });
  });
  app.post('/api/session/new', async (req, res) => {
    if (!req.body || Object.keys(req.body).length) throw new AppError('invalid_session', 'A new demo requires an empty JSON object.');
    const sessionId = store.createSession();
    res.cookie('pb_session', store.browserToken(sessionId), { httpOnly: true, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
    res.json({ workspace: await snapshot(sessionId) });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'route_not_found', message: 'That app operation does not exist.' } }));
  if (existsSync(staticDirectory)) app.use(express.static(staticDirectory));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const malformed = error.type === 'entity.parse.failed';
    res.status(malformed ? 400 : error.status ?? 500).json({ error: malformed ? { code: 'invalid_json', message: 'The JSON request could not be read.' } : publicError(error) });
  });
  const server = await new Promise((resolveServer, reject) => {
    const listening = app.listen(port, '127.0.0.1', () => resolveServer(listening));
    listening.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { app, server, store, model, origin, async close() { server.closeIdleConnections(); await new Promise(done => server.close(done)); model.close?.(); store.close(); } };
}
