import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const enabled = process.env.DSH_RUNTIME_TESTS === '1';
const base = process.env.DSH_RUNTIME_DIR || '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh';
if (enabled) {
  const require = createRequire(import.meta.url);
  const urls = Object.fromEntries(['@deepseek-ai/schemastery', '@deepseek-ai/dsh-session'].map(name => [name,
    pathToFileURL(require.resolve(name, { paths: [base] })).href]));
  registerHooks({ resolve(specifier, context, next) { return next(urls[specifier] ?? specifier, context); } });
}
const load = name => import(pathToFileURL(`${base}/node_modules/@deepseek-ai/${name}/lib/index.js`).href);

test('native runtime: projection, authenticated RPC and tool share archive and restore operations', { skip: !enabled }, async t => {
  const { Context } = await load('cordis');
  const { SessionStore } = await load('dsh-session');
  const projectionModule = await load('dsh-session-projection');
  const plugin = await import('../index.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-auto-archive-runtime-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  const native = new Context();
  const sessionFiber = await native.plugin(SessionStore);
  const projectionFiber = await native.plugin(projectionModule.default ?? projectionModule.SessionProjectionRegistry);
  const cleanups = [];
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await projectionFiber.dispose(); await sessionFiber.dispose();
    if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  });
  const archived = new Set();
  let route, tool;
  const rpc = async (method, payload) => {
    const response = await route.fetch(new Request(`http://localhost/api/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'fixture-rpc', method, payload }),
    }));
    assert.equal(response.status, 200);
    const envelope = await response.json();
    assert.equal(envelope.rpcId, 'fixture-rpc');
    return envelope.result;
  };
  const header = { id: 'native-archive-fixture', version: 4, cwd: root, createdAt: 1, isSeeded: false };
  const events = [
    { type: 'turn/start', seq: 0, time: 2, data: { turn: 1 } },
    { type: 'user/message', seq: 1, time: 3, data: { id: 'user', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Fixture' }] }, surfaceOp: 'append' },
    { type: 'session/title', seq: 2, time: 4, data: { title: 'Native fixture' } },
    { type: 'turn/end', seq: 3, time: 5, data: { turn: 1, reason: { kind: 'completed' } } },
  ];
  const ctx = {
    sessionProjections: native.sessionProjections, sessions: { get: () => undefined },
    sessionPersistence: { list: async () => [{ header, revision: 'one' }],
      open: async () => ({ header, inheritedEventCount: 0, read: async () => ({ events }), close: async () => {} }) },
    workspaceController: { async *follow() { yield { type: 'baseline', value: { items: [], archivedSessionIds: [...archived], pinnedSessionIds: [] } }; } },
    workspaceRegistry: { archiveSession: async id => { archived.add(id); }, unarchiveSession: async id => { archived.delete(id); } },
    connection: {
      rpc: { intercept: () => { throw new Error('Shared /api interceptor is already owned by Harness'); } },
      fetch: { register: definition => {
        assert.equal(definition.path, '/api/local-auto-archive/execute');
        assert.deepEqual(definition.methods, ['POST']);
        route = definition; return () => {};
      } },
    },
    tools: { register: definition => { tool = definition; return () => {}; } },
    waterfall: async (_name, _request, next) => next(), provide: () => {}, logger: { warn() {} },
    effect: install => { const cleanup = install(); cleanups.push(cleanup); return cleanup; },
  };
  await plugin.apply(ctx);
  const signal = new AbortController().signal;
  const malformed = await route.fetch(new Request('http://localhost/api/local-auto-archive/execute', { method: 'POST', body: '{}' }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(tool.parameters.properties.action.enum, ['status', 'save', 'archive', 'protect', 'undo']);
  assert.equal(Object.hasOwn(tool.parameters.properties, 'previewId'), false);
  const status = await tool.execute({ action: 'status' }, { signal });
  const saved = await rpc(plugin.endpoint, { action: 'save', revision: status.revision,
    settings: { ...status.config, enabled: true, days: 2 } });
  assert.equal(saved.ok, true);
  assert.equal(saved.value.config.enabled, true);
  assert.equal(archived.size, 0);
  const archivedResult = await rpc(plugin.endpoint, { action: 'archive', revision: saved.value.revision });
  assert.equal(archivedResult.ok, true);
  assert.equal(archivedResult.value.result.archived, 1);
  const value = archivedResult.value;
  const restored = await tool.execute({ action: 'undo', revision: value.revision, historyId: value.history[0].id }, { signal });
  assert.equal(restored.history[0].status, 'restored');
  assert.equal(archived.size, 0);
});
