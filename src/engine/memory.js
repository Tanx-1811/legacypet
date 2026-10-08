import { strings } from '../i18n/index.js';
import { VERSION } from '../whatsnew.js';
import { MOOD_EMOJI } from './mood.js';

const round1 = (n) => Math.round(n * 10) / 10;

// pet.json: what the pet remembers between runs (achievements, mood history,
// events) and a public, machine-readable status anyone can build on.
export function nextState(pet, prevState = null) {
  const history = [
    { date: pet.date, mood: pet.mood },
    ...(prevState?.history ?? []).filter((h) => h.date !== pet.date),
  ].slice(0, 90);
  return {
    schema: 1,
    generator: 'legacypet',
    version: VERSION,
    generatedAt: pet.generatedAt,
    repo: pet.repo.fullName,
    born: prevState?.born ?? pet.date,
    pet: {
      name: pet.name,
      displayName: pet.displayName,
      species: pet.speciesId,
      shiny: pet.shiny,
      stage: pet.stage,
      level: pet.level,
      mood: pet.mood,
      speech: pet.speech,
      accessories: pet.accessories,
      aura: pet.aura,
    },
    vitals: pet.vitals,
    facts: {
      daysSinceCommit: round1(pet.facts.daysSinceCommit),
      commits7: pet.facts.commits7,
      streak: pet.facts.streak,
      totalCommits: pet.facts.totalCommits,
      stars: pet.facts.stars,
      ageDays: Math.floor(pet.facts.ageDays),
    },
    achievements: pet.achievementsMap,
    events: pet.eventDates,
    history,
    lastMood: pet.mood,
    lastStage: pet.stage,
  };
}

// The last `days` moods as emoji, oldest first: a tiny mood chart for READMEs and summaries.
export function moodStrip(history = [], days = 14) {
  return [...history]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days)
    .reverse()
    .map((h) => MOOD_EMOJI[h.mood] ?? '·')
    .join('');
}

const ENTRY = /^- \*\*(\d{4}-\d{2}-\d{2})\*\*/;

export function diaryEntry(pet, snapshot) {
  const tr = strings(pet.lang);
  const parts = [tr.diary.day(Math.floor(pet.facts.ageDays) + 1), `${MOOD_EMOJI[pet.mood]} ${tr.moods[pet.mood]}`];
  parts.push(pet.facts.commits1 > 0 ? tr.diary.ate(pet.facts.commits1) : tr.diary.fasted);
  const treat = snapshot.treats?.[0];
  if (treat && Date.parse(pet.generatedAt) - Date.parse(treat.mergedAt) < 86_400_000) {
    parts.push(tr.diary.treat(treat.user, treat.number));
  }
  if (pet.newAchievements.length) {
    const list = pet.achievements
      .filter((a) => a.isNew)
      .map((a) => `${a.emoji} ${tr.achievements[a.id]}`)
      .join(', ');
    parts.push(tr.diary.unlocked(list));
  }
  return `- **${pet.date}** · ${parts.join(' · ')} · “${pet.speech}”`;
}

// One line per day, newest first. Re-running on the same day replaces that day's line.
export function updateDiary(previous, pet, snapshot, { max = 365 } = {}) {
  const tr = strings(pet.lang);
  const older = (previous ?? '')
    .split(/\r?\n/)
    .filter((line) => ENTRY.test(line) && ENTRY.exec(line)[1] !== pet.date);
  const entries = [diaryEntry(pet, snapshot), ...older].slice(0, max);
  return [tr.diary.title(pet.name), '', tr.diary.intro(pet.repo.fullName), '', ...entries, ''].join('\n');
}
