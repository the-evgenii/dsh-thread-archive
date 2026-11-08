import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('installation examples use the canonical Harness GitHub source', async () => {
  const text = await readFile(new URL('README.md', root), 'utf8');
  const expected = 'github:the-evgenii/dsh-thread-archive';
  const source = text.match(/```text\n([^\n]+)\n```/)[1];
  const tool = JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(source, expected);
  assert.equal(tool.target, expected);
  assert.equal(tool.action, 'install_bundle');
});

test('package uses default Harness artwork instead of a custom icon', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(Object.hasOwn(manifest, 'icon'), false);
  assert.equal(Object.hasOwn(manifest.exports, './icon'), false);
  assert.equal(manifest.files.includes('icon.svg'), false);
  await assert.rejects(access(new URL('icon.svg', root)), { code: 'ENOENT' });
});
