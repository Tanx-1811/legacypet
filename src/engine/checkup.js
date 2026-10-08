import { strings } from '../i18n/index.js';
import { daysBetween } from '../util/time.js';

// A plain-language health check: why the pet feels the way it does, and what would help.
// Each item is { level: 'good' | 'warn' | 'bad' | 'tip', icon, text }.
export function checkup(pet, snapshot) {
  const tr = strings(pet.lang).checkup;
  const items = [];
  const add = (level, icon, text) => items.push({ level, icon, text });
  const days = Math.floor(pet.facts.daysSinceCommit);

  if (snapshot.repo.archived) add('tip', '💤', tr.archived);
  else if (pet.vacation) add('good', '🏖️', tr.vacation(pet.vacation.until));
  else if (days < 7) add('good', '🍖', tr.fed(days));
  else add(days >= 25 ? 'bad' : 'warn', '🍖', tr.feed(days));

  const ci = snapshot.ci;
  if (!ci || ci.state === 'unknown') add('tip', '🩺', tr.noCi);
  else if (ci.state === 'failing') add('bad', '🤒', tr.ciFailing(ci.failingNames.join(', ') || '?'));
  else if (ci.state === 'pending') add('tip', '⏳', tr.ciPending);
  else add('good', '❤️', tr.ciPassing);

  const issues = snapshot.issues;
  if (issues) {
    const stale = issues.stale + issues.stalePRs;
    if (issues.unanswered.length) {
      const oldest = issues.unanswered[0];
      add('warn', '💬', tr.unanswered(issues.unanswered.length, oldest.number, oldest.days));
    }
    if (stale) add('warn', '🕸️', tr.stale(stale));
    if (!issues.unanswered.length && !stale) add('good', '😊', tr.issuesFine);
  }

  if (!snapshot.release) add('tip', '🚀', tr.noRelease);
  else add('good', '🚀', tr.release(snapshot.release.tag, Math.floor(daysBetween(snapshot.release.publishedAt, pet.generatedAt))));

  const hygiene = pet.vitals.hygiene;
  if (hygiene === 100) add('good', '🧼', tr.hygieneFull);
  else if (hygiene != null) add('tip', '🧼', tr.hygiene(hygiene));

  if (pet.facts.streak >= 3) add('good', '🔥', tr.streak(pet.facts.streak));
  return items;
}
