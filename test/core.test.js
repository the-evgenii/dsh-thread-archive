import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ArchiveEngine, DEFAULTS, validateSettings, languageFor, projection } from '../core.js';

const DAY = 86400000, now = 100 * DAY;
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-archive-test-'));
  const archived = new Set(), pinned = new Set(), live = new Set(), active = new Set();
  const list = ['old', 'new', 'pin', 'protected', 'project', 'live', 'active', 'child', 'similar-project'].map(id => ({
    header: { id, createdAt: now - 30 * DAY, cwd: id === 'project' ? '/workspace/excluded/sub' : id === 'similar-project' ? '/workspace/excluded-other' : '/workspace', ...(id === 'child' ? { origin: 'subagent' } : {}) }, revision: '1',
  }));
  pinned.add('pin'); live.add('live'); active.add('active');
  const adapter = {
    baseline: async () => ({ archivedSessionIds: [...archived], pinnedSessionIds: [...pinned], items: [{ path: '/workspace', title: 'Workspace' }] }),
    list: async () => list, isLive: id => live.has(id), isActive: async id => active.has(id),
    summary: async snapshot => ({ title: snapshot.header.id, lastActivity: snapshot.header.id === 'new' ? now - DAY : now - 30 * DAY }),
    archive: async id => { if (active.has(id)) throw new Error('Active'); archived.add(id); },
    unarchive: async id => { archived.delete(id); },
  };
  const file = path.join(root, 'state.json');
  const engine = new ArchiveEngine(file, adapter, () => now);
  await engine.start();
  t.after(async () => { await engine.stop(); await rm(root, { recursive: true, force: true }); });
  return { engine, adapter, archived, pinned, active, live, file };
}
async function request(engine, action, extra = {}) { return engine.handle({ action, revision: engine.data.revision, ...extra }); }

test('language selection uses Harness language, manual overrides and English fallback', () => {
  assert.equal(languageFor('auto', 'ru-RU'), 'ru');
  assert.equal(languageFor('en', 'ru'), 'en');
  assert.equal(languageFor('ru', 'zh'), 'ru');
  assert.equal(languageFor('auto', 'zh'), 'en');
  assert.equal(languageFor('auto', 'fr'), 'en');
});
test('settings are validated without silently widening the policy', () => {
  assert.equal(validateSettings({}).enabled, false);
  for (const patch of [{ days: 0 }, { intervalMinutes: 1 }, { language: 'zh' }, { excludedProjects: ['relative'] }, { extra: true }]) {
    assert.throws(() => validateSettings(patch), /INVALID_SETTINGS/);
  }
});
test('projection ignores metadata writes and tracks actual activity', () => {
  const first = projection.init({ createdAt: 1 });
  assert.equal(projection.apply(first, { type: 'sandbox/mode', time: 30, data: {} }), first);
  assert.equal(projection.apply(first, { type: 'user/message', time: 20, data: { source: { kind: 'runtime-context' } } }), first);
  const next = projection.apply(first, { type: 'user/message', time: 20, data: { source: { kind: 'user' } } });
  assert.equal(next.lastActivity, 20);
  assert.equal(projection.apply(next, { type: 'turn/end', time: 25, data: {} }).lastActivity, 25);
});
test('selection excludes protected, pinned, active, open and child sessions and project subdirectories', async t => {
  const { engine, archived } = await fixture(t);
  await request(engine, 'protect', { sessionId: 'protected', protected: true });
  await request(engine, 'save', { settings: { ...DEFAULTS, excludedProjects: ['/workspace/excluded'] } });
  const selected = await engine.candidates();
  assert.deepEqual(selected.candidates.map(item => item.id).sort(), ['old', 'similar-project']);
  assert.equal(archived.size, 0);
});
test('enabling and changing the policy save directly and survive restart without archiving', async t => {
  const { engine, adapter, archived, file } = await fixture(t);
  await request(engine, 'save', { settings: { ...DEFAULTS, enabled: true, language: 'ru' } });
  await request(engine, 'save', { settings: { ...engine.data.config, days: 2, excludedProjects: ['/workspace/excluded'] } });
  assert.equal(archived.size, 0);
  const restored = new ArchiveEngine(file, adapter, () => now); await restored.start();
  assert.equal(restored.data.config.language, 'ru'); assert.equal(restored.data.config.enabled, true);
  assert.equal(restored.data.config.days, 2);
  assert.deepEqual(restored.data.config.excludedProjects, ['/workspace/excluded']);
  await restored.stop();
});
test('archiving rechecks activity, restores only owned history and prevents immediate re-archival', async t => {
  const { engine, adapter, archived, active } = await fixture(t);
  const baseline = adapter.baseline;
  let checks = 0;
  adapter.baseline = async () => {
    if (++checks === 2) active.add('similar-project');
    return baseline();
  };
  const result = await request(engine, 'archive');
  assert.ok(archived.has('old')); assert.ok(!archived.has('similar-project'));
  assert.equal(result.result.skipped, 1);
  const own = result.history.find(item => item.sessionId === 'old');
  await request(engine, 'undo', { historyId: own.id });
  assert.ok(!archived.has('old'));
  const again = await engine.candidates();
  assert.ok(!again.candidates.some(item => item.id === 'old'));
  await assert.rejects(request(engine, 'undo', { historyId: 'not-owned' }), /UNDO_UNAVAILABLE/);
});
test('stale mutations and removed actions fail without archiving', async t => {
  const { engine, archived } = await fixture(t);
  await assert.rejects(engine.handle({ action: 'protect', revision: 99, sessionId: 'old', protected: true }), /REVISION_CONFLICT/);
  await assert.rejects(engine.handle({ action: 'archive', revision: 99 }), /REVISION_CONFLICT/);
  await assert.rejects(request(engine, 'preview'), /UNKNOWN_ACTION/);
  await assert.rejects(request(engine, 'archive', { previewId: 'obsolete' }), /INVALID_SETTINGS/);
  assert.equal(archived.size, 0);
});
test('timer is off by default and uses the same guarded operation after enabling', async t => {
  const { engine, archived } = await fixture(t);
  await engine.tick(); assert.equal(archived.size, 0);
  await request(engine, 'save', { settings: { ...DEFAULTS, enabled: true } });
  await request(engine, 'protect', { sessionId: 'protected', protected: true });
  await engine.tick();
  assert.ok(archived.has('old')); assert.ok(!archived.has('protected')); assert.ok(!archived.has('pin'));
});
test('native archive failure is recorded and never reported as success', async t => {
  const { engine, adapter, file } = await fixture(t);
  adapter.archive = async () => { throw new Error('Active session race'); };
  const result = await request(engine, 'archive');
  assert.equal(result.result.archived, 0); assert.ok(result.result.errors.length > 0);
  const persisted = JSON.parse(await readFile(file, 'utf8'));
  assert.ok(persisted.history.every(item => item.status === 'failed'));
});

test('policy changes while enabled take effect on the next scheduled check', async t => {
  const { engine, archived } = await fixture(t);
  await request(engine, 'save', { settings: { ...DEFAULTS, enabled: true, days: 3650 } });
  await engine.tick();
  assert.equal(archived.size, 0);
  await request(engine, 'save', { settings: { ...engine.data.config, days: 1 } });
  assert.equal(archived.size, 0);
  await engine.tick();
  assert.equal(archived.has('new'), true);
  assert.equal(archived.has('pin'), false);
});

test('partial save preserves unrelated settings and exclusions', async t => {
  const { engine } = await fixture(t);
  const config = { ...DEFAULTS, days: 90, intervalMinutes: 15, keepPinned: false,
    language: 'ru', excludedProjects: ['/excluded'] };
  await request(engine, 'save', { settings: config });
  await request(engine, 'save', { settings: { enabled: true } });
  assert.deepEqual(engine.data.config, { ...config, enabled: true });
  await assert.rejects(request(engine, 'save'), /INVALID_SETTINGS/);
  await assert.rejects(request(engine, 'save', { settings: null }), /INVALID_SETTINGS/);
});

for (const change of ['opened', 'pinned']) {
  test(`thread ${change} during the pending-history write is skipped without archiving`, async t => {
    const { engine, adapter, archived, pinned, live } = await fixture(t);
    const persist = engine.persist.bind(engine);
    engine.persist = async next => {
      await persist(next);
      if (next.history[0]?.sessionId === 'old' && next.history[0]?.status === 'pending') {
        (change === 'opened' ? live : pinned).add('old');
      }
    };
    const nativeArchive = adapter.archive;
    adapter.archive = async id => { await nativeArchive(id); pinned.delete(id); };
    const result = await request(engine, 'archive');
    assert.equal(archived.has('old'), false);
    assert.equal(result.history.find(row => row.sessionId === 'old').status, 'skipped');
    assert.ok(result.result.skipped > 0);
    if (change === 'pinned') assert.equal(pinned.has('old'), true);
  });
}

test('legacy state drops obsolete fields and preserves settings, protection and restorable history', async t => {
  const { engine, adapter, file } = await fixture(t);
  await request(engine, 'save', { settings: { ...DEFAULTS, enabled: true, days: 2, language: 'ru' } });
  await request(engine, 'protect', { sessionId: 'protected', protected: true });
  const history = [{ id: 'owned', sessionId: 'old', title: 'Old', at: now, status: 'archived' }];
  const legacy = { ...engine.data, history, restoredAt: { restored: now }, previewedCriteria: 'legacy' };
  await engine.stop();
  await writeFile(file, JSON.stringify(legacy));
  const restored = new ArchiveEngine(file, adapter, () => now);
  await restored.start();
  try {
    const status = await restored.status();
    assert.deepEqual(status.config, legacy.config);
    assert.deepEqual(status.protectedIds, legacy.protectedIds);
    assert.deepEqual(status.history, history);
    assert.deepEqual(status.restoredAt, legacy.restoredAt);
    assert.equal(Object.hasOwn(status, 'previewedCriteria'), false);
    const persisted = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(Object.hasOwn(persisted, 'previewedCriteria'), false);
    assert.equal(persisted.revision, legacy.revision + 1);
  } finally { await restored.stop(); }
});
