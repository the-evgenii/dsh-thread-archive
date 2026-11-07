window.__ModuleLoader__.load({ id: '@local/dsh-thread-archive', factory: require => {
  const React = require('react');
  const h = React.createElement;
  // Adapted from @deepseek-ai/dsh-client-ui-primitives 0.2.2-rc.1 (MIT).
  // Kept package-local as required for dynamic plugins; see THIRD-PARTY-NOTICES.md.
  const classes = (...values) => values.filter(Boolean).join(' ');
  const Button = React.forwardRef(function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }, ref) {
    return h('button', { ref, type: 'button', className: classes('daa-button', `daa-${variant}`, `daa-${size}`, className), ...rest },
      icon != null && h('span', { className: 'daa-button-icon' }, icon), children);
  });
  function Switch({ checked, onChange, label, disabled = false, title, className }) {
    return h('button', { type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label,
      title, disabled, className: classes('daa-switch', className), onClick: () => onChange(!checked) },
    h('span', { className: 'daa-switch-thumb' }));
  }
  function Checkbox({ checked, onChange, label, disabled = false, title, className }) {
    return h('label', { className: classes('daa-checkbox', className), title },
      h('input', { type: 'checkbox', checked, disabled, onChange: event => onChange(event.target.checked) }), h('span', null, label));
  }
  const Input = React.forwardRef(function Input({ icon, className, ...rest }, ref) {
    return h('span', { className: classes('daa-input-wrap', className) },
      icon != null && h('span', { className: 'daa-input-icon' }, icon),
      h('input', { ref, className: 'daa-input', ...rest }));
  });
  const isWalkKey = key => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key);
  function walk(options, from, key) {
    const enabled = options.filter(option => option.disabled !== true);
    if (key === 'Home') return enabled[0];
    if (key === 'End') return enabled[enabled.length - 1];
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
    for (let offset = 1; offset < options.length; offset++) {
      const candidate = options[((from + step * offset) % options.length + options.length) % options.length];
      if (candidate && candidate.disabled !== true) return candidate;
    }
  }
  function SegmentedControl({ id, value, options, onChange, label, disabled = false, className }) {
    const list = React.useRef(null);
    const selected = options.findIndex(option => option.value === value);
    React.useEffect(() => {
      const root = list.current;
      if (root?.contains(root.ownerDocument.activeElement)) root.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    }, [value]);
    const onKeyDown = event => {
      if (!isWalkKey(event.key)) return;
      event.preventDefault();
      const target = walk(options, selected, event.key);
      if (target && target.value !== value) onChange(target.value);
    };
    return h('div', { ref: list, role: 'tablist', 'aria-label': label, className: classes('daa-segments', className),
      style: { '--daa-segment-count': String(options.length), '--daa-segment-index': String(selected) } },
    h('span', { 'aria-hidden': true, className: 'daa-segment-indicator' }), ...options.map(option => {
      const active = option.value === value;
      return h('button', { key: option.value, id: `${id}-${option.value}`, type: 'button', role: 'tab',
        'aria-selected': active, 'aria-controls': `${id}-${option.value}-panel`, tabIndex: active ? 0 : -1,
        disabled: disabled || option.disabled === true, title: option.title, className: 'daa-segment-tab',
        onClick: () => { if (!active) onChange(option.value); }, onKeyDown }, option.label);
    }));
  }
  const EN = {
    title: 'Auto archive', intro: 'Hide inactive conversations without deleting their data. No model calls.',
    enabled: 'Enable auto archive', days: 'Archive after inactivity (days)', interval: 'Check interval (minutes)',
    pinned: 'Skip pinned conversations', language: 'Language', auto: 'Harness language', autoShort: 'Auto',
    projects: 'Excluded projects', noProjects: 'No registered projects', save: 'Save settings', saved: 'Settings saved',
    history: 'History (last 300 entries)', noHistory: 'No archive history yet', undo: 'Restore',
    protected: 'Protected conversations', unprotect: 'Remove protection', noProtected: 'No protected conversations',
    loading: 'Loading…', busy: 'Working…', archived: 'Archived', restored: 'Restored',
    pending: 'Pending', failed: 'Failed', skipped: 'Skipped', refresh: 'Refresh',
    REVISION_CONFLICT: 'Settings changed elsewhere. Refresh the page and try again.',
    INVALID_SETTINGS: 'Use 1–3650 days and a 5–1440 minute interval. Check the other settings.',
    UNDO_UNAVAILABLE: 'This history entry cannot be restored.', error: 'Operation failed',
  };
  const RU = {
    title: 'Автоархивация', intro: 'Скрывает неактивные треды без удаления данных. Без вызовов модели.',
    enabled: 'Включить автоархивацию', days: 'Архивировать после неактивности (дней)', interval: 'Интервал проверки (минут)',
    pinned: 'Пропускать закреплённые треды', language: 'Язык', auto: 'Как в Harness', autoShort: 'Авто',
    projects: 'Исключённые проекты', noProjects: 'Нет зарегистрированных проектов', save: 'Сохранить настройки', saved: 'Настройки сохранены',
    history: 'История (последние 300 записей)', noHistory: 'История архивации пока пуста', undo: 'Восстановить',
    protected: 'Защищённые треды', unprotect: 'Снять защиту', noProtected: 'Нет защищённых тредов',
    loading: 'Загрузка…', busy: 'Выполняется…', archived: 'В архиве', restored: 'Восстановлен',
    pending: 'Ожидает завершения', failed: 'Ошибка', skipped: 'Пропущен', refresh: 'Обновить',
    REVISION_CONFLICT: 'Настройки изменены в другом окне. Обновите страницу и повторите.',
    INVALID_SETTINGS: 'Допустимо 1–3650 дней и интервал 5–1440 минут. Проверьте остальные настройки.',
    UNDO_UNAVAILABLE: 'Эту запись истории нельзя восстановить.', error: 'Операция не выполнена',
  };
  // Native Button, Switch, Checkbox, Input and SegmentedControl styles, with local class names.
  const style = `
.daa{color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;max-width:840px;width:100%;box-sizing:border-box}
.daa h2{font-size:16px;line-height:24px;font-weight:600;margin:0 0 8px}.daa h3{font-size:14px;line-height:20px;font-weight:500;margin:24px 0 4px}
.daa p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin:8px 0}
.daa section{margin:24px 0 0;padding:0}
.daa-setting{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.daa-field{display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:12px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);font-size:13px;line-height:1.5}
.daa-field>span:first-child{font-weight:500}
.daa-language-row{align-items:flex-start}
.daa-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:16px}
.daa-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:.5px solid var(--dsw-alias-border-l2)}
.daa-detail{min-width:0;overflow-wrap:anywhere;font-size:13px}.daa small{display:block;color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}
.daa .daa-error{color:var(--dsw-alias-state-error-primary)}.daa .daa-notice{color:var(--dsw-alias-state-success-primary)}
.daa-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px}
.daa-button:disabled{cursor:not-allowed;opacity:.4}.daa-md{height:36px}.daa-sm{height:28px;font-size:12px;line-height:18px;padding:0 10px;border-radius:var(--dsw-radius-sm)}
.daa-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.daa-ghost:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.daa-outline{border:.5px solid transparent;background:transparent;box-shadow:inset 0 0 0 var(--dsh-hairline-width,.5px) var(--dsh-button-outline-color,var(--dsw-alias-border-l3))}
.daa-button-icon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center}
.daa-button:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.daa-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer}
.daa-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}.daa-switch:disabled{cursor:default;opacity:.5}
.daa-switch:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.daa-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease}
.daa-switch[aria-checked=false] .daa-switch-thumb{background:var(--dsw-alias-switch-thumb)}.daa-switch[aria-checked=true] .daa-switch-thumb{transform:translateX(16px)}
.daa-checkbox{display:inline-flex;align-items:center;gap:6px;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer}
.daa-checkbox input{flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:inherit}
.daa-checkbox input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.daa-checkbox:has(input:disabled){cursor:default;opacity:.5}.daa-project{display:flex;padding:10px 0;gap:10px}
.daa-input-wrap{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);min-width:0}
.daa-input-wrap:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.daa-input-icon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
.daa-input{flex:1;min-width:0;width:100%;border:none;outline:none;background:transparent;font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.daa-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.daa-segments{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}
.daa-segment-indicator{position:absolute;top:4px;left:4px;width:calc((100% - 8px - 2px * (var(--daa-segment-count) - 1)) / var(--daa-segment-count));height:calc(100% - 8px);border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);transform:translateX(calc(var(--daa-segment-index) * (100% + 2px)));transition:transform 160ms ease;pointer-events:none}
.daa-segment-tab{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 10px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;transition:color 120ms ease}
.daa-segment-tab[aria-selected=true]{color:var(--dsw-alias-label-primary)}.daa-segment-tab:disabled{cursor:default;opacity:.4}
.daa-segment-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
@media(hover:hover){.daa-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.daa-ghost:hover:not(:disabled),.daa-outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.daa-segment-tab:hover:not(:disabled){color:var(--dsw-alias-label-primary)}}
@media(prefers-reduced-motion:reduce){.daa-segment-indicator,.daa-segment-tab,.daa-switch-thumb{transition:none}}
@media(max-width:560px){.daa-row{align-items:flex-start;flex-wrap:wrap}}
`;
  const NS = 'local-auto-archive';
  const choose = (preference, active) => (preference === 'auto' ? active : preference).toLowerCase().startsWith('ru') ? 'ru' : 'en';
  function apply(ctx) {
    for (const [language, dictionary] of [['ru', RU], ['en', EN]]) {
      for (const active of ['en', 'zh', 'ru']) ctx.effect(() => ctx.locale.register(`${NS}.${language}`, active, dictionary));
    }
    let savedLanguage = 'auto';
    let refreshNavigation = () => {};
    const translate = preference => ctx.locale.bind(`${NS}.${choose(preference, ctx.locale.getLocale().active)}`);
    const subscribe = callback => ctx.locale.subscribe(callback);
    const snapshot = () => ctx.locale.getSnapshot();
    async function call(action, payload = {}, signal) {
      const result = await ctx.connection.rpc.call('/api', 'local-auto-archive/execute', { ...payload, action }, signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    }
    function Page() {
      React.useSyncExternalStore(subscribe, snapshot);
      const [data, setData] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const t = translate(draft?.language ?? savedLanguage);
      function receive(value) {
        setData(value); setDraft(value.config);
        const before = choose(savedLanguage, ctx.locale.getLocale().active);
        savedLanguage = value.config.language;
        if (before !== choose(savedLanguage, ctx.locale.getLocale().active)) refreshNavigation();
      }
      React.useEffect(() => {
        const controller = new AbortController();
        call('status', {}, controller.signal).then(receive).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
        return () => controller.abort();
      }, []);
      async function work(action, extra = {}) {
        setBusy(true); setError(''); setNotice('');
        try {
          const value = await call(action, { revision: data?.revision, ...extra });
          receive(value);
          if (action === 'save') setNotice('saved');
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
      }
      const button = (key, action, extra = {}, disabled = false) => h(Button, {
        variant: key === 'save' ? 'primary' : 'outline', size: 'sm', disabled: busy || disabled,
        onClick: () => work(action, extra) }, t(key));
      const toggle = (key, checked, onChange) => h('div', { key, className: 'daa-setting' },
        h('span', null, t(key)), h(Switch, { checked, disabled: busy, label: t(key), onChange }));
      const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
      const dirty = Boolean(data && JSON.stringify(draft) !== JSON.stringify(data.config));
      if (!data || !draft) return h('div', { className: 'daa' }, h('style', null, style),
        h('h2', null, t('title')), h('p', { role: error ? 'alert' : 'status' }, error ? `${t('error')}: ${error}` : t('loading')),
        error && button('refresh', 'status'));
      const projects = [...new Map([...data.projects, ...draft.excludedProjects.map(path => ({ path, title: path }))]
        .map(item => [item.path, item])).values()];
      return h('div', { className: 'daa' }, h('style', null, style), h('h2', null, t('title')), h('p', null, t('intro')),
        h('section', null,
          toggle('enabled', draft.enabled, value => update('enabled', value)),
          h('div', { className: 'daa-field daa-language-row' }, h('span', null, t('language')),
            h(SegmentedControl, { id: 'daa-language', value: draft.language, disabled: busy, label: t('language'),
              options: [{ value: 'auto', label: t('autoShort'), title: t('auto') },
                { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }],
              onChange: value => update('language', value) })),
          h('div', { role: 'tabpanel', id: `daa-language-${draft.language}-panel`, 'aria-labelledby': `daa-language-${draft.language}` },
            ...[['days', 1, 3650], ['intervalMinutes', 5, 1440]].map(([key, min, max]) => h('label', { key, className: 'daa-field' },
              h('span', null, t(key === 'days' ? 'days' : 'interval')),
              h(Input, { type: 'number', min, max, step: 1, value: draft[key], disabled: busy,
                onChange: event => update(key, Number(event.target.value)) }))),
            toggle('pinned', draft.keepPinned, value => update('keepPinned', value)),
            h('h3', null, t('projects')),
            projects.length ? projects.map(project => h(Checkbox, { key: project.path, className: 'daa-project',
              disabled: busy, checked: draft.excludedProjects.includes(project.path),
              onChange: checked => update('excludedProjects', checked ? [...draft.excludedProjects, project.path]
                : draft.excludedProjects.filter(value => value !== project.path)),
              label: h('span', { className: 'daa-detail' }, project.title, h('small', null, project.path)),
            })) : h('p', null, t('noProjects')),
            h('div', { className: 'daa-actions' }, button('save', 'save', { settings: draft }, !dirty)))),
        error && h('p', { className: 'daa-error', role: 'alert' }, t(error) === error ? `${t('error')}: ${error}` : t(error)),
        notice && h('p', { className: 'daa-notice', role: 'status' }, t('saved')),
        busy && h('p', { role: 'status' }, t('busy')),
        h('section', null, h('h3', null, t('protected')),
          data.protectedIds.length ? data.protectedIds.map(id => h('div', { key: id, className: 'daa-row' },
            h('span', { className: 'daa-detail' }, id), button('unprotect', 'protect', { sessionId: id, protected: false }))) : h('p', null, t('noProtected'))),
        h('section', null, h('h3', null, t('history')),
          data.history.length ? data.history.map(item => h('div', { key: item.id, className: 'daa-row' },
            h('div', { className: 'daa-detail' }, item.title, h('small', null,
              `${new Date(item.at).toLocaleString(choose(draft.language, ctx.locale.getLocale().active))} · ${t(item.status)}`)),
            item.status === 'archived' && button('undo', 'undo', { historyId: item.id }))) : h('p', null, t('noHistory')),
          h('div', { className: 'daa-actions' }, button('refresh', 'status'))));
    }
    ctx.slots.inject('settings.section', () => {
      let dispose;
      const register = () => {
        dispose?.();
        dispose = ctx.slots.register({ name: 'settings.section', id: 'local-auto-archive', order: 35,
          label: () => translate(savedLanguage)('title') }, Page);
      };
      refreshNavigation = register;
      register();
      const unsubscribe = ctx.locale.subscribe(register);
      return () => { unsubscribe(); dispose?.(); refreshNavigation = () => {}; };
    });
  }
  return { apply, inject: ['slots', 'locale', 'connection'], controls: { Button, Switch, Checkbox, Input, SegmentedControl, walk } };
} });
