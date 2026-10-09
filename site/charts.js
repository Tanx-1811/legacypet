// Small charts for the app, in plain SVG: the activity calendar, a ranked bar list and
// stat tiles. One hue (the accent) for magnitude; every mark answers on hover, and each
// chart carries a hidden table for screen readers.
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

// One tooltip for every chart: the value first, then what it is.
let tip = null;
function showTip(event, strong, rest) {
  tip ??= document.body.appendChild(el('div', 'chart-tip'));
  tip.replaceChildren(el('b', '', strong), el('span', '', rest));
  tip.hidden = false;
  const { clientX: x, clientY: y } = event;
  const box = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - box.width - 8, Math.max(8, x - box.width / 2))}px`;
  tip.style.top = `${y - box.height - 12 < 8 ? y + 16 : y - box.height - 12}px`;
}
const hideTip = () => { if (tip) tip.hidden = true; };

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// GitHub-style levels: 0 for none, then quartiles of the busy days.
function levels(values) {
  const busy = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!busy.length) return () => 0;
  const q = (p) => busy[Math.min(busy.length - 1, Math.floor(p * busy.length))];
  const [a, b, c] = [q(0.25), q(0.5), q(0.75)];
  return (v) => (v <= 0 ? 0 : v <= a ? 1 : v <= b ? 2 : v <= c ? 3 : 4);
}

// activity: { 'YYYY-MM-DD': commits }. Weeks run left to right, days top to bottom.
export function heatmap(activity, { locale = 'en', weeks = 53, end = new Date(), title = '', value = (n) => String(n), less = 'Less', more = 'More' } = {}) {
  const weekStart = locale === 'vi' ? 1 : 0;
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  const first = new Date(last);
  first.setDate(first.getDate() - (weeks - 1) * 7 - ((last.getDay() - weekStart + 7) % 7));
  const days = [];
  for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push({ date: new Date(d), n: activity[dayKey(d)] ?? 0 });
  const level = levels(days.map((d) => d.n));
  const CELL = 11;
  const STEP = 14;
  const LEFT = 30;
  const TOP = 18;
  const cols = Math.ceil(days.length / 7);
  const svg = svgEl('svg', { viewBox: `0 0 ${LEFT + cols * STEP} ${TOP + 7 * STEP}`, class: 'heatmap', role: 'img', 'aria-label': title });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const fullFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  // Weekday names on three rows, month names where a month starts.
  for (const row of [1, 3, 5]) {
    const sample = new Date(first);
    sample.setDate(sample.getDate() + row);
    svg.append(Object.assign(svgEl('text', { x: 0, y: TOP + row * STEP + CELL - 2, class: 'axis' }), { textContent: dayFmt.format(sample) }));
  }
  let lastMonth = -1;
  days.forEach((day, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    if (row === 0 && day.date.getMonth() !== lastMonth && col < cols - 1) {
      lastMonth = day.date.getMonth();
      if (col > 0 || day.date.getDate() <= 7) svg.append(Object.assign(svgEl('text', { x: LEFT + col * STEP, y: 11, class: 'axis' }), { textContent: monthFmt.format(day.date) }));
    }
    const rect = svgEl('rect', { x: LEFT + col * STEP, y: TOP + row * STEP, width: CELL, height: CELL, rx: 2.5, class: `h${level(day.n)}` });
    rect.dataset.i = i;
    svg.append(rect);
  });
  svg.addEventListener('pointermove', (e) => {
    const i = e.target.dataset?.i;
    if (i == null) return hideTip();
    const day = days[i];
    showTip(e, value(day.n), fullFmt.format(day.date));
  });
  svg.addEventListener('pointerleave', hideTip);

  const legend = el('div', 'heat-legend');
  legend.append(el('span', '', less));
  for (let i = 0; i <= 4; i++) {
    const sw = svgEl('svg', { viewBox: '0 0 11 11', width: 11, height: 11, 'aria-hidden': 'true' });
    sw.append(svgEl('rect', { width: 11, height: 11, rx: 2.5, class: `h${i}` }));
    legend.append(sw);
  }
  legend.append(el('span', '', more));

  // The same numbers as a table, by month, for screen readers.
  const months = new Map();
  for (const d of days) {
    const key = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d.date);
    months.set(key, (months.get(key) ?? 0) + d.n);
  }
  const table = el('table', 'sr-only');
  table.append(el('caption', '', title));
  for (const [month, n] of months) {
    const tr = el('tr');
    tr.append(el('th', '', month), el('td', '', value(n)));
    table.append(tr);
  }

  const wrap = el('div', 'heat-wrap');
  const scroller = el('div', 'heat-scroll');
  scroller.append(svg);
  wrap.append(scroller, legend, table);
  // Show the newest weeks first when it doesn't fit.
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
  return wrap;
}

// Ranked rows with a bar each: [{ label, sub, value, href }]. The value sits at the bar's tip.
export function barList(items, { format = (n) => String(n) } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const list = el('ol', 'bar-list');
  for (const item of items) {
    const row = el(item.href ? 'a' : 'div', 'bar-row');
    if (item.href) row.href = item.href;
    const head = el('div', 'bar-head');
    head.append(el('span', 'bar-label', item.label), item.sub ? el('span', 'bar-sub', item.sub) : '');
    const track = el('div', 'bar-track');
    const fill = el('i');
    fill.style.width = `${Math.max(2, (item.value / max) * 100)}%`;
    track.append(fill, el('span', 'bar-value', format(item.value)));
    row.append(head, track);
    const li = el('li');
    li.append(row);
    list.append(li);
  }
  return list;
}

// A stat tile: label, value, and an optional line under it (a delta reads green or red).
export function statTile({ label, value, sub = '', trend = null, icon = null }) {
  const tile = el('div', 'stat');
  const head = el('div', 'stat-label');
  if (icon) head.append(icon);
  head.append(el('span', '', label));
  tile.append(head, el('div', 'stat-value', value));
  if (sub) tile.append(el('div', `stat-sub${trend ? ` ${trend}` : ''}`, sub));
  return tile;
}

export const localDayKey = dayKey;
