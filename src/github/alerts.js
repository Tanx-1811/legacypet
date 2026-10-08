import { checkup } from '../engine/checkup.js';
import { strings } from '../i18n/index.js';

// Care alerts: when the pet stays sick (or turns into a zombie...) the owner gets one GitHub
// issue about it, kept up to date and closed automatically once the pet feels better.
// They're opt-in, and built not to nag: an alert needs two runs in a row in the same bad mood
// (one flaky CI run isn't an emergency), there is only ever one issue, closing it by hand mutes
// it until the pet recovers, and a pet on vacation never raises one.
export const ALERT_MOODS = ['sick', 'zombie', 'hungry', 'sad'];
const DEFAULT_MOODS = ['sick', 'zombie'];
export const ALERT_LABEL = 'legacypet';
const CHECK_ICON = { good: '✅', warn: '⚠️', bad: '❌', tip: '💡' };

// The `alerts` input: false (default), true (sick + zombie), or a list like "sick, zombie, hungry".
export function parseAlerts(spec) {
  const text = String(spec ?? '').trim().toLowerCase();
  if (!text || ['false', 'off', 'no', '0'].includes(text)) return null;
  if (['true', 'on', 'yes', '1'].includes(text)) return new Set(DEFAULT_MOODS);
  const moods = text.split(/[\s,]+/).filter(Boolean);
  const unknown = moods.filter((m) => !ALERT_MOODS.includes(m));
  if (unknown.length) throw new Error(`Unknown alert mood "${unknown[0]}". Use true, false or a list of: ${ALERT_MOODS.join(', ')}`);
  return new Set(moods);
}

export function alertIssue(pet, snapshot, { since, cardUrl } = {}) {
  const tr = strings(pet.lang);
  const days = Math.floor(pet.facts.daysSinceCommit);
  return {
    title: tr.alert.title[pet.mood](pet.name, days),
    body: [
      ...(cardUrl ? [`<img src="${cardUrl}" alt="${pet.displayName}" width="420">`, ''] : []),
      `**${tr.alert.intro}** ${tr.alert.since(since ?? pet.date)}`,
      '',
      `> ${pet.speech}`,
      '',
      `### 🩺 ${tr.command.checkup}`,
      '',
      ...checkup(pet, snapshot).map((item) => `- ${CHECK_ICON[item.level]} ${item.icon} ${item.text}`),
      '',
      `<sub>${tr.alert.footer}</sub>`,
    ].join('\n'),
  };
}

// Brings the alert issue in line with how the pet feels. Returns what pet.json should remember:
// { issue, mood, since, muted? } while an alert is open, or null.
export async function syncAlert(client, { owner, repo, pet, snapshot, moods, prev = null, prevMood = null, cardUrl }) {
  const base = `/repos/${owner}/${repo}`;
  const unwell = Boolean(moods?.has(pet.mood)) && !pet.vacation;
  const tr = strings(pet.lang);

  if (prev?.issue) {
    const issue = await client.get(`${base}/issues/${prev.issue}`).catch(() => null);
    if (!issue) return null; // deleted or transferred: start over next time
    if (!unwell) {
      if (issue.state === 'open') {
        await client.post(`${base}/issues/${prev.issue}/comments`, { body: tr.alert.recovered(pet.name, tr.moods[pet.mood]) });
        await client.patch(`${base}/issues/${prev.issue}`, { state: 'closed', state_reason: 'completed' });
      }
      return null;
    }
    // Closed by a human while the pet is still unwell: stay quiet until it recovers.
    if (issue.state === 'closed') return { ...prev, muted: true };
    const next = alertIssue(pet, snapshot, { since: prev.since, cardUrl });
    if (issue.title !== next.title || issue.body !== next.body) await client.patch(`${base}/issues/${prev.issue}`, next);
    return { issue: prev.issue, mood: pet.mood, since: prev.since };
  }

  if (!unwell || prevMood !== pet.mood) return null;
  const next = alertIssue(pet, snapshot, { since: pet.date, cardUrl });
  // If pet.json was lost (say a failed publish), adopt the alert we opened before instead of a duplicate.
  const open = await client.get(`${base}/issues`, { query: { labels: ALERT_LABEL, state: 'open', per_page: 10 } }).catch(() => []);
  const existing = (open ?? []).find((i) => !i.pull_request);
  if (existing) {
    await client.patch(`${base}/issues/${existing.number}`, next);
    return { issue: existing.number, mood: pet.mood, since: pet.date };
  }
  const created = await client.post(`${base}/issues`, { ...next, labels: [ALERT_LABEL] })
    .catch(() => client.post(`${base}/issues`, next)); // the token may not be allowed to create labels
  return { issue: created.number, mood: pet.mood, since: pet.date };
}
