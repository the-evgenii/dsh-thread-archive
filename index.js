import os from 'node:os';
import path from 'node:path';
import z from '@deepseek-ai/schemastery';
import { Session } from '@deepseek-ai/dsh-session';
import { ArchiveEngine, projection } from './core.js';

export const inject = ['sessionPersistence', 'sessionProjections', 'sessions', 'workspaceRegistry', 'workspaceController', 'connection', 'tools'];
export const endpoint = 'local-auto-archive/execute';
export const parameters = {
  type: 'object', additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['status', 'save', 'archive', 'protect', 'undo'], default: 'status',
      description: 'archive runs immediately using saved settings; save changes settings without archiving.' },
    revision: { type: 'integer', description: 'Revision from status; required for save, archive, protect and undo.' },
    settings: { type: 'object', additionalProperties: false, properties: {
      enabled: { type: 'boolean' }, days: { type: 'integer', minimum: 1, maximum: 3650 },
      intervalMinutes: { type: 'integer', minimum: 5, maximum: 1440 }, keepPinned: { type: 'boolean' },
      language: { type: 'string', enum: ['auto', 'ru', 'en'] }, excludedProjects: { type: 'array', items: { type: 'string' } },
    } },
    sessionId: { type: 'string', description: 'Session to protect or unprotect.' },
    protected: { type: 'boolean' }, historyId: { type: 'string', description: 'Own archived history entry to restore.' },
  },
};
export async function apply(ctx) {
  const activity = await ctx.sessionProjections.register({ ...projection,
    stateSchema: z.object({ lastActivity: z.number(), title: z.string() }) });
  const cache = new Map();
  const adapter = {
    async baseline() {
      const controller = new AbortController();
      const stream = ctx.workspaceController.follow(controller.signal)[Symbol.asyncIterator]();
      try {
        const { value } = await stream.next();
        if (value?.type !== 'baseline') throw new Error('WORKSPACE_UNAVAILABLE');
        return value.value;
      } finally { controller.abort(); await stream.return?.(); }
    },
    list: () => ctx.sessionPersistence.list(),
    isLive: id => Boolean(ctx.sessions.get(id)),
    isActive: async id => (await ctx.waterfall('workspace/session-activity', { sessionId: id }, async () => [])).length > 0,
    async summary(snapshot) {
      const id = snapshot.header.id;
      const cached = cache.get(id);
      if (cached?.revision === snapshot.revision) return cached.summary;
      const handle = await ctx.sessionPersistence.open(id, 'read');
      try {
        const { events } = await handle.read();
        const session = Session.create(id, events, handle.header, handle.inheritedEventCount);
        const summary = activity.stateOf(session);
        if (cache.size >= 2000) cache.delete(cache.keys().next().value);
        cache.set(id, { revision: snapshot.revision, summary });
        return summary;
      } finally { await handle.close(); }
    },
    archive: id => ctx.workspaceRegistry.archiveSession(id),
    unarchive: id => ctx.workspaceRegistry.unarchiveSession(id),
  };
  const file = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'state', 'local-auto-archive', 'state.json');
  const engine = new ArchiveEngine(file, adapter);
  await engine.start();
  ctx.provide('localAutoArchive', engine);
  let timer;
  const schedule = () => {
    clearInterval(timer);
    if (engine.data.config.enabled) {
      timer = setInterval(() => { void engine.tick().catch(error => ctx.logger.warn('Auto archive: %s', error.message)); },
        engine.data.config.intervalMinutes * 60000);
      timer.unref?.();
    }
  };
  const execute = async (request, signal) => {
    const result = await engine.handle(request, signal);
    if (request.action === 'save') schedule();
    return result;
  };
  // Exact routes share Harness authentication without replacing its /api interceptor.
  ctx.effect(() => ctx.connection.fetch.register({
    path: `/api/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      let message;
      try { message = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
      if (message?.type !== 'client-request' || typeof message.rpcId !== 'string' || message.method !== endpoint) {
        return new Response('Invalid request envelope', { status: 400 });
      }
      let result;
      try { result = { ok: true, value: await execute(message.payload, request.signal) }; }
      catch (error) { result = { ok: false, error: { code: 'auto-archive/error', message: error.message, details: {} } }; }
      return Response.json({ type: 'server-response', rpcId: message.rpcId, result }, { headers: { 'cache-control': 'no-store' } });
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'local_auto_archive', description: 'Настройки, защита, автоархивация и восстановление тредов без удаления данных.',
    parameters, output: { schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: (args, exec) => execute(args, exec.signal),
  }));
  schedule();
  ctx.effect(() => async () => { clearInterval(timer); await engine.stop(); cache.clear(); });
}
