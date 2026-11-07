import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, readFile, rename, writeFile, lstat } from 'node:fs/promises';

export const DEFAULTS = Object.freeze({ enabled: false, days: 14, intervalMinutes: 60, keepPinned: true, language: 'auto', excludedProjects: [] });
const DAY = 86400000;
export function languageFor(preference, hostLanguage = 'en') {
  return (preference === 'auto' ? hostLanguage : preference).toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
export function validateSettings(value, current = DEFAULTS) {
  if (!value || Object.keys(value).some(key => !(key in DEFAULTS))) throw new Error('INVALID_SETTINGS');
  const result = { ...current, ...value };
  if (typeof result.enabled !== 'boolean' || typeof result.keepPinned !== 'boolean'
      || !Number.isInteger(result.days) || result.days < 1 || result.days > 3650
      || !Number.isInteger(result.intervalMinutes) || result.intervalMinutes < 5 || result.intervalMinutes > 1440
      || !['auto', 'ru', 'en'].includes(result.language)
      || !Array.isArray(result.excludedProjects) || result.excludedProjects.length > 1000
      || result.excludedProjects.some(item => typeof item !== 'string' || !path.isAbsolute(item))) throw new Error('INVALID_SETTINGS');
  return { ...result, excludedProjects: [...new Set(result.excludedProjects)] };
}
export const projection = {
  key: 'localAutoArchiveActivity', stateVersion: 1,
  init: header => ({ lastActivity: header.createdAt, title: '' }),
  apply: (state, event) => {
    if (event.type === 'session/title' && typeof event.data.title === 'string') return { ...state, title: event.data.title };
    if (event.type === 'turn/end' || (event.type === 'user/message' && event.data.source?.kind === 'user')) {
      return { ...state, lastActivity: Math.max(state.lastActivity, event.time) };
    }
    return state;
  },
};
function under(directory, root) {
  const relative = path.relative(root, directory);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export class ArchiveEngine {
  constructor(file, adapter, clock = Date.now) {
    Object.assign(this, { file, adapter, clock });
    this.data = { version: 1, revision: 0, config: { ...DEFAULTS }, protectedIds: [], restoredAt: {}, history: [] };
    this.tail = Promise.resolve();
    this.closed = false;
  }
  async start() {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      if ((await lstat(this.file)).isSymbolicLink()) throw new Error('UNSAFE_STATE');
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.protectedIds)
          || !Array.isArray(data.history) || !data.restoredAt || typeof data.restoredAt !== 'object') throw new Error('INVALID_STATE');
      const { version, revision, protectedIds, restoredAt, history } = data;
      this.data = { version, revision, config: validateSettings(data.config), protectedIds, restoredAt, history };
      // Discard obsolete state fields without changing settings or archive history.
      if (Object.keys(data).some(key => !Object.hasOwn(this.data, key))) await this.persist(this.data);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (this.data.history.some(item => item.status === 'pending')) {
      const archived = new Set((await this.adapter.baseline()).archivedSessionIds);
      await this.persist({ ...this.data, history: this.data.history.map(item => item.status === 'pending'
        ? { ...item, status: archived.has(item.sessionId) ? 'archived' : 'failed' } : item) });
    }
  }
  async persist(next) {
    const value = { ...next, revision: this.data.revision + 1 };
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.file);
    this.data = value;
  }
  async status() {
    const baseline = await this.adapter.baseline();
    return { ...structuredClone(this.data), projects: baseline.items.map(item => ({ path: item.path, title: item.title })) };
  }
  async candidates() {
    const baseline = await this.adapter.baseline();
    const archived = new Set(baseline.archivedSessionIds), pinned = new Set(baseline.pinnedSessionIds);
    const protectedIds = new Set(this.data.protectedIds);
    const candidates = [], errors = [];
    for (const snapshot of await this.adapter.list()) {
      const header = snapshot.header, id = header.id;
      if (this.closed) break;
      if (header.origin === 'subagent' || header.parentSession || snapshot.formatStatus === 'migration-required'
          || archived.has(id) || protectedIds.has(id) || this.adapter.isLive(id)
          || (this.data.config.keepPinned && pinned.has(id))
          || this.data.config.excludedProjects.some(root => header.cwd && under(header.cwd, root))) continue;
      try {
        if (await this.adapter.isActive(id)) continue;
        const summary = await this.adapter.summary(snapshot);
        const lastActivity = Math.max(summary.lastActivity, this.data.restoredAt[id] ?? 0);
        if (!Number.isFinite(lastActivity) || lastActivity > this.clock()
            || this.clock() - lastActivity < this.data.config.days * DAY) continue;
        candidates.push({ id, title: summary.title || id, cwd: header.cwd ?? '',
          idleDays: Math.floor((this.clock() - lastActivity) / DAY), lastActivity });
      } catch { errors.push({ id, code: 'SESSION_READ_FAILED' }); }
    }
    return { candidates, errors };
  }
  handle(request, signal) {
    const task = this.tail.then(async () => {
      if (this.closed) throw new Error('PLUGIN_STOPPED');
      signal?.throwIfAborted();
      const action = request?.action ?? 'status';
      if (!['status', 'save', 'archive', 'protect', 'undo'].includes(action)) throw new Error('UNKNOWN_ACTION');
      if (Object.keys(request ?? {}).some(key => !['action', 'revision', 'settings', 'sessionId', 'protected', 'historyId'].includes(key))) {
        throw new Error('INVALID_SETTINGS');
      }
      if (action === 'status') return this.status();
      if (request.revision !== this.data.revision) throw new Error('REVISION_CONFLICT');
      if (action === 'save') {
        const config = validateSettings(request.settings, this.data.config);
        await this.persist({ ...this.data, config });
      } else if (action === 'archive') {
        const result = await this.archive(signal);
        return { ...await this.status(), result };
      } else if (action === 'protect') {
        if (typeof request.sessionId !== 'string' || !request.sessionId || typeof request.protected !== 'boolean') throw new Error('INVALID_SETTINGS');
        const ids = new Set(this.data.protectedIds);
        request.protected ? ids.add(request.sessionId) : ids.delete(request.sessionId);
        if (ids.size > 1000) throw new Error('INVALID_SETTINGS');
        await this.persist({ ...this.data, protectedIds: [...ids] });
      } else if (action === 'undo') {
        const row = this.data.history.find(item => item.id === request.historyId);
        if (!row || row.status !== 'archived') throw new Error('UNDO_UNAVAILABLE');
        await this.adapter.unarchive(row.sessionId);
        const restoredAt = { ...this.data.restoredAt, [row.sessionId]: this.clock() };
        await this.persist({ ...this.data, restoredAt, history: this.data.history.map(item => item.id === row.id
          ? { ...item, status: 'restored', restoredAt: this.clock() } : item) });
      } else throw new Error('UNKNOWN_ACTION');
      return this.status();
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async canArchive(id, signal) {
    if (await this.adapter.isActive(id)) return false;
    const latest = await this.adapter.baseline();
    return !this.closed && !signal?.aborted && !this.adapter.isLive(id)
      && !latest.archivedSessionIds.includes(id)
      && (!this.data.config.keepPinned || !latest.pinnedSessionIds.includes(id));
  }
  async archive(signal) {
    const fresh = await this.candidates();
    const result = { archived: 0, skipped: 0, errors: fresh.errors };
    for (const item of fresh.candidates) {
      if (this.closed || signal?.aborted) break;
      if (!await this.canArchive(item.id, signal)) { result.skipped++; continue; }
      const row = { id: randomUUID(), sessionId: item.id, title: item.title, cwd: item.cwd, at: this.clock(), status: 'pending' };
      await this.persist({ ...this.data, history: [row, ...this.data.history].slice(0, 300) });
      try {
        // The pending-history write yields to user actions. Recheck AFTER it.
        if (!await this.canArchive(item.id, signal)) {
          row.status = 'skipped'; result.skipped++;
        } else {
          await this.adapter.archive(item.id);
          row.status = 'archived'; result.archived++;
        }
      } catch { row.status = 'failed'; result.errors.push({ id: item.id, code: 'ARCHIVE_FAILED' }); }
      await this.persist({ ...this.data, history: this.data.history.map(item => item.id === row.id ? { ...row } : item) });
    }
    return result;
  }
  tick() {
    const task = this.tail.then(async () => {
      if (this.closed || !this.data.config.enabled) return;
      return this.archive();
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async stop() { this.closed = true; await this.tail; }
}
