// The command palette (⌘K / Ctrl+K): jump to any page or project, or run an action, from the keyboard.
// items(): [{ group, icon, label, hint, keywords, run, searchOnly }]
// `searchOnly` items (every species, say) wait until something is typed, so the list starts short.

// Loose matching: every typed character in order, word starts score higher.
function score(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at !== -1) return 100 - at + (at === 0 || /\W/.test(t[at - 1]) ? 50 : 0);
  let i = 0;
  let points = 0;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) { points += j === 0 || /\W/.test(t[j - 1]) ? 3 : 1; i++; }
  }
  return i === q.length ? points : 0;
}

export function createPalette({ h, icon, t, items }) {
  let dialog = null;
  let shown = [];
  let active = 0;

  function close() {
    dialog?.close();
  }

  function open() {
    if (dialog?.open) return close();
    const T = t().palette;
    const input = h('input', { type: 'text', placeholder: T.placeholder, 'aria-label': T.placeholder, autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list' });
    const list = h('div.palette-list', { id: 'palette-list', role: 'listbox' });
    const all = items();

    function draw() {
      const q = input.value.trim();
      shown = all
        .map((item) => ({ item, s: score(q, `${item.label} ${item.keywords ?? ''} ${item.hint ?? ''}`) }))
        .filter((x) => x.s > 0 && (q || !x.item.searchOnly))
        .sort((a, b) => (q ? b.s - a.s : 0))
        .slice(0, 60)
        .map((x) => x.item);
      active = Math.min(active, Math.max(0, shown.length - 1));
      if (!shown.length) return list.replaceChildren(h('div.palette-empty', T.empty));
      const groups = new Map();
      shown.forEach((item, i) => {
        if (!groups.has(item.group)) groups.set(item.group, []);
        groups.get(item.group).push([item, i]);
      });
      list.replaceChildren(...[...groups].map(([group, rows]) => h('div.palette-group', { role: 'group', 'aria-label': T.groups[group] ?? group },
        h('div.palette-head', T.groups[group] ?? group),
        rows.map(([item, i]) => h('div.palette-item', {
          role: 'option', id: `palette-${i}`, 'aria-selected': String(i === active),
          onpointermove: () => { if (active !== i) { active = i; mark(); } },
          onclick: () => run(i),
        }, item.icon ? icon(item.icon, { size: 16 }) : null, h('span.palette-label', item.label), item.hint ? h('span.palette-hint', item.hint) : null)))));
      mark();
    }

    function mark() {
      for (const row of list.querySelectorAll('.palette-item')) row.setAttribute('aria-selected', String(row.id === `palette-${active}`));
      input.setAttribute('aria-activedescendant', `palette-${active}`);
      list.querySelector(`#palette-${active}`)?.scrollIntoView({ block: 'nearest' });
    }

    function run(i) {
      const item = shown[i];
      if (!item) return;
      close();
      item.run();
    }

    input.addEventListener('input', () => { active = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });

    const kbd = (key, text) => h('span', h('kbd.kbd', key), ` ${text}`);
    dialog = h('dialog.palette', { 'aria-label': T.placeholder },
      h('div.palette-search', icon('search', { size: 18 }), input, h('kbd.kbd', 'Esc')),
      list,
      h('div.palette-foot', kbd('↑↓', T.keys.move), kbd('↵', T.keys.open), kbd('Esc', T.keys.close)));
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    document.body.append(dialog);
    dialog.showModal();
    active = 0;
    draw();
    input.focus();
  }

  return { open, close, get isOpen() { return Boolean(dialog?.open); } };
}
