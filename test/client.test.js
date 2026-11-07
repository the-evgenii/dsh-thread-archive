import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the published browser entry without rendering a mock application.
// The slot contract is taken from the installed Harness registration template.
async function fixture() {
  let plugin;
  const script = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { window: { __ModuleLoader__: { load: entry => {
    plugin = entry.factory(name => {
      assert.equal(name, 'react');
      return {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        forwardRef: render => render,
      };
    });
  } } } });
  const dictionaries = new Map(), listeners = new Set(), pages = new Map(), cleanups = [];
  let active = 'en';
  const locale = {
    register(namespace, language, dictionary) {
      dictionaries.set(`${namespace}:${language}`, dictionary);
      return () => dictionaries.delete(`${namespace}:${language}`);
    },
    bind: namespace => key => dictionaries.get(`${namespace}:${active}`)?.[key] ?? key,
    getLocale: () => ({ active }),
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  };
  plugin.apply({
    locale, connection: {},
    effect(setup) { cleanups.push(setup()); },
    slots: {
      inject(name, setup) { assert.equal(name, 'settings.section'); cleanups.push(setup()); },
      register(options, component) {
        if (options.name !== 'settings.section') throw new Error(`slot "${options.name}" is not declared (a parent entry's children table must declare it)`);
        assert.equal(typeof component, 'function');
        pages.set(options.id, options);
        return () => pages.delete(options.id);
      },
    },
  });
  return { controls: plugin.controls, pages, listeners, cleanups, dictionaries,
    changeLocale(language) { active = language; for (const listener of listeners) listener(); },
  };
}

test('browser plugin registers its settings page with the Harness slot name and cleans up on unload', async () => {
  const { pages, listeners, cleanups, dictionaries } = await fixture();
  assert.equal(pages.size, 1);
  assert.equal(pages.get('local-auto-archive').label(), 'Auto archive');
  assert.equal(listeners.size, 1);
  for (const cleanup of cleanups.reverse()) cleanup?.();
  assert.equal(pages.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(dictionaries.size, 0);
});

test('settings navigation switches RU/EN without duplicate page registrations', async t => {
  const { pages, changeLocale, cleanups } = await fixture();
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup?.(); });
  changeLocale('ru');
  assert.equal(pages.size, 1);
  assert.equal(pages.get('local-auto-archive').label(), 'Автоархивация');
  changeLocale('en');
  assert.equal(pages.size, 1);
  assert.equal(pages.get('local-auto-archive').label(), 'Auto archive');
  changeLocale('zh');
  assert.equal(pages.get('local-auto-archive').label(), 'Auto archive');
});

test('Harness Switch exposes native switch semantics and controlled changes', async t => {
  const { controls, cleanups } = await fixture();
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup?.(); });
  let value;
  const element = controls.Switch({ checked: true, label: 'Auto archive', onChange: next => { value = next; } });
  assert.equal(element.type, 'button');
  assert.equal(element.props.role, 'switch');
  assert.equal(element.props['aria-checked'], true);
  assert.equal(element.props['aria-label'], 'Auto archive');
  element.props.onClick();
  assert.equal(value, false);
});

test('Harness Button and Input retain their native sizing, variants and numeric constraints', async t => {
  const { controls, cleanups } = await fixture();
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup?.(); });
  const button = controls.Button({ variant: 'primary', size: 'sm', disabled: true, children: 'Save' }, null);
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.disabled, true);
  assert.match(button.props.className, /daa-primary/);
  assert.match(button.props.className, /daa-sm/);
  const input = controls.Input({ type: 'number', min: 1, max: 3650, value: 2 }, null);
  const native = input.props.children.at(-1);
  assert.equal(native.type, 'input');
  assert.equal(native.props.type, 'number');
  assert.equal(native.props.min, 1);
  assert.equal(native.props.max, 3650);
  assert.equal(native.props.value, 2);
});

test('Harness project checkbox keeps the native label and controlled checked state', async t => {
  const { controls, cleanups } = await fixture();
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup?.(); });
  let checked;
  const label = controls.Checkbox({ checked: false, label: 'Project', disabled: true,
    onChange: value => { checked = value; } });
  assert.equal(label.type, 'label');
  const input = label.props.children[0];
  assert.equal(input.props.type, 'checkbox');
  assert.equal(input.props.disabled, true);
  assert.equal(input.props.checked, false);
  input.props.onChange({ target: { checked: true } });
  assert.equal(checked, true);
});

test('Harness language control navigation wraps and skips disabled options', async t => {
  const { controls, cleanups } = await fixture();
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup?.(); });
  const options = [{ value: 'auto' }, { value: 'ru', disabled: true }, { value: 'en' }];
  assert.equal(controls.walk(options, 0, 'ArrowRight').value, 'en');
  assert.equal(controls.walk(options, 0, 'ArrowLeft').value, 'en');
  assert.equal(controls.walk(options, 2, 'ArrowRight').value, 'auto');
  assert.equal(controls.walk(options, 2, 'Home').value, 'auto');
  assert.equal(controls.walk(options, 0, 'End').value, 'en');
  assert.equal(controls.walk([{ disabled: true }], 0, 'ArrowRight'), undefined);
});

test('settings layout matches Telegram Sync full-width stacked fields and typography', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  const field = source.match(/\.daa-field\{([^}]+)\}/)[1];
  assert.match(field, /display:flex/);
  assert.match(field, /flex-direction:column/);
  assert.match(field, /gap:6px/);
  assert.match(field, /padding:12px 0/);
  const input = source.match(/\.daa-input-wrap\{([^}]+)\}/)[1];
  assert.match(input, /width:100%/);
  assert.match(input, /height:34px/);
  assert.match(input, /var\(--dsw-alias-bg-layer-3\)/);
  const title = source.match(/\.daa h2\{([^}]+)\}/)[1];
  assert.match(title, /font-size:16px/);
  assert.match(title, /line-height:24px/);
});

test('settings page contains saving and history without any preview UI or hidden prerequisite', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /preview|предпросмотр|data\.candidates/i);
  assert.match(source, /button\('save', 'save'/);
  assert.match(source, /button\('undo', 'undo'/);
  assert.doesNotMatch(source, /button\('archive'/);
});
