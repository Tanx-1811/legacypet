// The bridge to the LegacyPet app running on this computer (`legacypet app` or the desktop
// app). On GitHub Pages there is no server: LOCAL is false and none of this is used.
import { buildPet } from './src/index.js';

const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content ?? '';
const TOKEN = meta('legacypet-token');
export const LOCAL = Boolean(TOKEN);
export const MODE = meta('legacypet-mode') || (LOCAL ? 'browser' : 'web');
// Native extras the desktop app adds (folder dialogs, the desktop pet, open at login).
export const desktop = globalThis.legacypetDesktop ?? null;

export async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-legacypet-token': TOKEN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status });
  return data;
}

// Live updates: the server says when pets change (a refresh, a scan, a snack).
export function listen({ onChange, onEvent }) {
  if (!LOCAL || typeof EventSource === 'undefined') return () => {};
  const source = new EventSource(`/api/stream?token=${encodeURIComponent(TOKEN)}`);
  source.addEventListener('change', () => onChange?.());
  source.addEventListener('config', () => onChange?.());
  source.addEventListener('event', (e) => {
    try { onEvent?.(JSON.parse(e.data)); } catch { /* ignore a bad message */ }
  });
  return () => source.close();
}

// The same pet the server raised: buildPet is pure, so the same inputs give the same pet.
export function petOf(project, { lang, theme, ...extra } = {}) {
  if (!project?.snapshot) return null;
  return buildPet({
    snapshot: project.snapshot,
    prevState: project.prev,
    now: new Date(project.now),
    options: {
      ...project.options,
      lang: project.options?.lang || lang,
      care: project.care ?? undefined,
      ...extra,
    },
  });
}

const ATTENTION = { bad: 0, warn: 1, good: 2 };
// Pets that need care first, then the ones with work waiting, then the most recently active.
export function byNeed(a, b) {
  const s = (p) => ATTENTION[p.summary?.attention ?? 'good'] ?? 2;
  return s(a) - s(b)
    || Number(Boolean(b.ahead)) - Number(Boolean(a.ahead))
    || Date.parse(b.snapshot?.commits?.lastDate ?? 0) - Date.parse(a.snapshot?.commits?.lastDate ?? 0);
}
