// A pet's Insights and Code tabs in the app, and the pieces the Tools page shares with them:
// what git says about the repo (see src/local/insights.js), read when a tab opens and kept for
// the visit. Nothing here changes the repo; the buttons open files or copy commands.
import { barList, punchCard, stackBar, statTile } from './charts.js';
import { api } from './local.js';

// Every kind of commit (src/term/words.js: commitKind), with the dish the pet gets and a color.
export const KINDS = {
  feat: { emoji: '🍰', color: '#22b8a0' },
  fix: { emoji: '🍎', color: '#e5534b' },
  docs: { emoji: '🥠', color: '#d9a52b' },
  test: { emoji: '🥦', color: '#4fae54' },
  refactor: { emoji: '🍙', color: '#6c7dff' },
  style: { emoji: '🎨', color: '#a974f0' },
  perf: { emoji: '⚡', color: '#f08c2b' },
  chore: { emoji: '🍪', color: '#8d93a1' },
  ci: { emoji: '🤖', color: '#4f9cf0' },
  build: { emoji: '🧱', color: '#b07c4f' },
  revert: { emoji: '↩️', color: '#d4685a' },
  wip: { emoji: '🚧', color: '#c9a227' },
  merge: { emoji: '🍱', color: '#7b8798' },
  other: { emoji: '🍖', color: '#5f6673' },
};
export const kindOf = (kind) => KINDS[kind] ?? KINDS.other;

// Languages get the colors people know them by (GitHub's linguist), the rest a quiet grey.
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Rust: '#dea584', Go: '#00add8', Java: '#b07219', Kotlin: '#a97bff',
  Swift: '#f05138', Ruby: '#701516', PHP: '#4f5d95', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Dart: '#00b4ab', Vue: '#41b883',
  Svelte: '#ff3e00', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c', Shell: '#89e051', Lua: '#000080', Elixir: '#6e4a7e',
  Haskell: '#5e5086', Scala: '#c22d40', R: '#198ce7', 'Objective-C': '#438eff', Zig: '#ec915c', 'Jupyter Notebook': '#da5b0b',
};
const langColor = (name) => LANG_COLORS[name] ?? '#8b929e';

export const CHANGE_MARK = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflict: '!' };

export function fmtBytes(n, locale = 'en') {
  const units = [['gigabyte', 1e9], ['megabyte', 1e6], ['kilobyte', 1e3]];
  const [unit, size] = units.find(([, s]) => n >= s) ?? ['byte', 1];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: n >= size * 10 ? 0 : 1 }).format(n / size);
}

export function insightsKit(kit) {
  const { h, t, icon, btn, toast, store, ago, num, copyText } = kit;
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false && k !== ''));
  const loading = () => h('div.loading-row', icon('loader-circle', { size: 16, cls: 'spin' }), h('span', t().insights.loading));
  const failed = (err) => h('div.callout.bad', err.message ?? String(err));

  // One read per project and refresh (`p.now`): switching tabs back and forth costs nothing.
  const cache = new Map();
  function load(p, kind = 'insights', { fresh = false } = {}) {
    const key = `${kind}|${p.id}`;
    const hit = cache.get(key);
    if (!fresh && hit && hit.now === p.now) return hit.promise;
    const promise = api(`projects/${p.id}/${kind}`, {});
    cache.set(key, { now: p.now, promise });
    // A failed read is asked again next time (unless a newer one took its place meanwhile).
    promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
    return promise;
  }

  // Fills `box` when the data comes in; a redraw of the page meanwhile simply finds it cached.
  function whenLoaded(box, promise, draw) {
    fill(box, loading());
    promise.then((data) => fill(box, draw(data))).catch((err) => fill(box, failed(err)));
    return box;
  }

  async function openFile(p, path, line = null) {
    try {
      const res = await api(`projects/${p.id}/file`, { path, line });
      toast(t().home.opened(res.tool), 'good');
    } catch (err) { toast(err.message, 'bad'); }
  }

  const panel = (iconName, title, ...kids) => h('section.panel', h('div.panel-head', h('h3', icon(iconName, { size: 16 }), title), kids.shift() ?? null), ...kids);

  // ----- Insights: who, when, what kind, which languages, how well kept --------------------
  function insightsTab(p) {
    const T = t().insights;
    return whenLoaded(h('div.stack'), load(p), (d) => {
      const kinds = Object.entries(d.types).sort((a, b) => b[1] - a[1]);
      const kindsTotal = kinds.reduce((s, [, n]) => s + n, 0);
      const healthy = d.health.filter((x) => x.ok).length;
      return [
        h('div.kpis',
          statTile({ icon: icon('git-commit-horizontal', { size: 15 }), label: T.yearCommits, value: num(d.yearCommits) }),
          statTile({ icon: icon('users', { size: 15 }), label: T.people, value: num(d.authors.length) }),
          statTile({ icon: icon('file-code', { size: 15 }), label: T.files, value: num(d.fileCount), sub: fmtBytes(d.codeBytes, store.ui) }),
          statTile({ icon: icon('git-branch', { size: 15 }), label: T.branches, value: num(d.branchCount), sub: d.tags[0] ? T.lastTag(d.tags[0].name) : T.noTags })),
        h('div.grid2.even',
          panel('clock', T.when, h('span.small.muted', T.whenNote),
            d.yearCommits ? punchCard(d.punch, { locale: store.ui, title: T.when, value: (n) => T.commits(n) }) : h('p.muted', T.none),
            d.yearCommits ? h('p.small.muted.tight-top', T.peak(peakOf(d.punch, store.ui))) : null),
          panel('chart-pie', T.kinds, h('span.small.muted', T.kindsNote(d.typesDays)),
            kindsTotal ? stackBar(kinds.map(([k, n]) => ({ label: `${kindOf(k).emoji} ${T.kindNames[k] ?? k}`, value: n, color: kindOf(k).color, note: T.commits(n) }))) : h('p.muted', T.none),
            kindsTotal ? h('p.small.muted.tight-top', T.kindsTip(Math.round(((d.types.feat ?? 0) / kindsTotal) * 100), Math.round(((d.types.fix ?? 0) / kindsTotal) * 100))) : null)),
        h('div.grid2.even',
          panel('code-xml', T.languages, null,
            d.languages.length ? stackBar(d.languages.map((l) => ({ label: l.other ? T.otherLang : l.name, value: l.bytes, color: l.other ? '#8b929e' : langColor(l.name), note: fmtBytes(l.bytes, store.ui) }))) : h('p.muted', T.noLang)),
          panel('users', T.authors, h('span.small.muted', T.authorsNote),
            d.authors.length ? barList(d.authors.slice(0, 8).map((a) => ({ label: a.name, value: a.commits })), { format: num }) : h('p.muted', T.none))),
        h('div.grid2.even',
          panel('heart-pulse', T.health, h('span.score-pill', `${healthy}/${d.health.length}`),
            h('ul.health-list', d.health.map((x) => h(`li.${x.ok ? 'ok' : 'missing'}`,
              icon(x.ok ? 'circle-check' : 'circle-dot', { size: 15 }),
              h('div', h('b', T.checks[x.id]?.[0] ?? x.id), x.ok ? null : h('span.small.muted', T.checks[x.id]?.[1] ?? '')))))),
          panel('hard-drive', T.largest, null,
            d.largest.length ? h('ul.file-list', d.largest.map((f) => h('li',
              h('button.file-link', { type: 'button', title: T.openInEditor, onclick: () => openFile(p, f.path) }, icon('file-text', { size: 14 }), h('span.mono', f.path)),
              h('span.small.muted.mono', fmtBytes(f.size, store.ui))))) : h('p.muted', T.none))),
      ];
    });
  }

  // The busiest hour of the week, in words.
  function peakOf(grid, locale) {
    let best = [0, 0, 0];
    grid.forEach((row, d) => row.forEach((n, hr) => { if (n > best[0]) best = [n, d, hr]; }));
    const day = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2023, 0, 1 + best[1], 12));
    return `${day} ${String(best[2]).padStart(2, '0')}:00`;
  }

  // ----- Code: the working tree, branches, stashes, tags and TODOs --------------------------
  function codeTab(p) {
    const T = t().insights;
    const changesBox = h('div');
    const refsBox = h('div.stack');
    const todoBox = todoPanel(p);
    const draw = (fresh = false) => whenLoaded(changesBox, load(p, 'insights', { fresh }), (d) => changesPanel(p, d, () => draw(true)));
    draw();
    whenLoaded(refsBox, load(p), (d) => [branchesPanel(d), d.stashes.length ? stashPanel(d) : null, d.tags.length ? tagsPanel(d) : null]);
    return h('div.grid2.code-tab', h('div.stack', changesBox, todoBox), refsBox);
  }

  function changesPanel(p, d, reload) {
    const T = t().insights;
    const counts = {};
    for (const c of d.changes) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    const head = h('div.row',
      btn('', { icon: 'refresh-cw', kind: 'ghost sm', title: T.reload, onclick: reload }),
      btn('', { icon: 'code-xml', kind: 'ghost sm', title: T.openProject, onclick: () => api(`projects/${p.id}/open`, { with: 'editor' }).then((r) => toast(t().home.opened(r.tool), 'good')).catch((e) => toast(e.message, 'bad')) }));
    return h('section.panel',
      h('div.panel-head', h('h3', icon('pencil', { size: 16 }), T.changes, d.changesTotal ? h('span.count-pill', num(d.changesTotal)) : null), head),
      d.changesTotal
        ? [
          h('div.kind-chips', Object.entries(counts).map(([k, n]) => h(`span.change-chip.${k}`, h('b', CHANGE_MARK[k]), T.changeKinds[k], h('span.muted', n)))),
          h('ul.file-list.changes', d.changes.map((c) => h('li',
            h(`span.change-mark.${c.kind}`, { title: T.changeKinds[c.kind] }, CHANGE_MARK[c.kind]),
            c.kind === 'deleted'
              ? h('span.mono.file-path', c.path)
              : h('button.file-link', { type: 'button', title: T.openInEditor, onclick: () => openFile(p, c.path) }, h('span.mono', c.path)),
            c.staged ? h('span.pill.live', T.staged) : null))),
          d.changesTotal > d.changes.length ? h('p.small.muted', T.more(d.changesTotal - d.changes.length)) : null,
          h('p.small.muted.tight-top', T.changesNote),
        ]
        : h('div.clean-state', icon('check-check', { size: 20 }), h('div', h('b', T.clean), h('span.small.muted', T.cleanNote))));
  }

  function branchesPanel(d) {
    const T = t().insights;
    const merged = d.branches.filter((b) => b.merged);
    const cleanup = merged.map((b) => `git branch -d ${b.name}`).join('\n');
    return h('section.panel',
      h('div.panel-head', h('h3', icon('git-branch', { size: 16 }), T.branchList, h('span.count-pill', num(d.branchCount))),
        merged.length ? btn(T.copyCleanup(merged.length), { icon: 'copy', kind: 'sm ghost', title: cleanup, onclick: () => copyText(cleanup) }) : null),
      h('ul.branch-list', d.branches.slice(0, 25).map((b) => h(`li${b.current ? '.current' : ''}`,
        icon(b.current ? 'circle-check' : 'git-branch', { size: 14, cls: b.current ? 'ok-icon' : 'muted' }),
        h('div.branch-main',
          h('div.branch-name', h('b.mono', b.name),
            b.current ? h('span.pill.live', T.current) : null,
            b.merged ? h('span.pill', { title: T.mergedNote }, T.merged) : null,
            b.gone ? h('span.pill.warn', { title: T.goneNote }, T.gone) : null,
            b.ahead ? h('span.pill.warn', icon('arrow-up', { size: 11 }), b.ahead) : null,
            b.behind ? h('span.pill', icon('arrow-down', { size: 11 }), b.behind) : null),
          h('span.small.muted.clip', [b.subject, b.date ? ago(b.date) : ''].filter(Boolean).join(' · '))),
        b.current ? null : btn('', { icon: 'copy', kind: 'ghost sm', title: `git switch ${b.name}`, onclick: () => copyText(`git switch ${b.name}`) })))),
      d.branchCount > 25 ? h('p.small.muted', T.more(d.branchCount - 25)) : null);
  }

  function stashPanel(d) {
    const T = t().insights;
    return h('section.panel',
      h('div.panel-head', h('h3', icon('layers', { size: 16 }), T.stashes, h('span.count-pill', d.stashes.length))),
      h('ul.mini-list.plain', d.stashes.map((s) => h('li',
        h('div.mini-text', h('span', s.message), h('span.small.muted', [s.ref, s.date ? ago(s.date) : ''].filter(Boolean).join(' · '))),
        btn('', { icon: 'copy', kind: 'ghost sm', title: `git stash apply ${s.ref}`, onclick: () => copyText(`git stash apply ${s.ref}`) })))));
  }

  function tagsPanel(d) {
    const T = t().insights;
    return h('section.panel',
      h('div.panel-head', h('h3', icon('tag', { size: 16 }), T.tags)),
      h('div.tag-row', d.tags.map((tag) => h('span.tag-chip', { title: tag.date ? ago(tag.date) : '' }, icon('tag', { size: 12 }), tag.name))));
  }

  // TODO, FIXME, HACK and XXX in the code, filterable; each opens in the editor at its line.
  function todoPanel(p, { limit = 60 } = {}) {
    const T = t().insights;
    const box = h('section.panel');
    let shown = limit;
    let tag = '';
    const search = h('input', { type: 'search', placeholder: T.todoFilter, 'aria-label': T.todoFilter, autocomplete: 'off', spellcheck: 'false' });
    const listBox = h('div');
    let data = null;
    function drawList() {
      const q = search.value.trim().toLowerCase();
      const items = data.items.filter((x) => (!tag || x.tag === tag) && (!q || `${x.path} ${x.text}`.toLowerCase().includes(q)));
      fill(listBox,
        items.length ? h('ul.todo-list', items.slice(0, shown).map((x) => h('li',
          h(`span.todo-tag.${x.tag.toLowerCase()}`, x.tag),
          h('button.file-link.todo-main', { type: 'button', title: T.openInEditor, onclick: () => openFile(p, x.path, x.line) },
            h('span.todo-text', x.text.replace(new RegExp(`^${x.tag}\\b[:\\s(]*`), '') || x.text),
            h('span.small.muted.mono', `${x.path}:${x.line}`))))) : h('p.muted', data.total ? T.noMatch : T.noTodos),
        items.length > shown ? btn(T.showMore(items.length - shown), { kind: 'sm ghost', onclick: () => { shown += 100; drawList(); } }) : null,
        data.truncated ? h('p.small.muted', T.todoTruncated(data.total)) : null);
    }
    search.oninput = () => { shown = limit; drawList(); };
    function draw() {
      const counts = {};
      for (const x of data.items) counts[x.tag] = (counts[x.tag] ?? 0) + 1;
      const options = [['', T.all, data.items.length], ...Object.entries(counts).map(([id, n]) => [id, id, n])];
      const chips = h('div.seg.todo-seg', { role: 'group', 'aria-label': T.todos },
        options.map(([id, label, n]) => h('button', {
          type: 'button', 'aria-pressed': String(tag === id),
          onclick: (e) => { tag = id; for (const b of chips.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); drawList(); },
        }, label, h('span.count', n))));
      fill(box,
        h('div.panel-head', h('h3', icon('list-todo', { size: 16 }), T.todos, h('span.count-pill', num(data.total))),
          btn('', { icon: 'refresh-cw', kind: 'ghost sm', title: T.reload, onclick: () => { fill(box, loading()); load(p, 'todos', { fresh: true }).then((d) => { data = d; draw(); }).catch((err) => fill(box, failed(err))); } })),
        data.total ? h('div.todo-tools', h('div.search-box', icon('search', { size: 15 }), search), chips) : null,
        listBox);
      drawList();
    }
    fill(box, h('div.panel-head', h('h3', icon('list-todo', { size: 16 }), T.todos)), loading());
    load(p, 'todos').then((d) => { data = d; draw(); }).catch((err) => fill(box, failed(err)));
    return box;
  }

  return { insightsTab, codeTab, todoPanel, load, openFile };
}
