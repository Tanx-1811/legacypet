import { strings } from '../i18n/index.js';
import { VERSION } from '../whatsnew.js';
import { MOOD_EMOJI } from './mood.js';

const round1 = (n) => Math.round(n * 10) / 10;

// The order of the numbers in each history entry's `vitals`, kept short since pet.json holds 90 days.
export const VITALS = ['fullness', 'health', 'joy', 'energy'];

// pet.json: what the pet remembers between runs (achievements, mood history,
// events) and a public, machine-readable status anyone can build on.
export function nextState(pet, prevState = null) {
  const history = [
    { date: pet.date, mood: pet.mood, vitals: VITALS.map((k) => pet.vitals[k] ?? null) },
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
      rank: pet.rank?.id,
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
    vacations: pet.vacations ?? [],
    // The game: this week's quests, lifetime quest stars, the evolution path, snacks and friends, the wardrobe.
    quests: pet.quests ? { week: pet.quests.week, ids: pet.quests.ids, done: pet.quests.done } : prevState?.quests ?? null,
    questStars: pet.questStars ?? prevState?.questStars ?? 0,
    evolution: pet.evolution ?? prevState?.evolution ?? null,
    care: pet.care ? { day: pet.care.day, today: pet.care.today, total: pet.care.total, friends: pet.care.friends } : prevState?.care ?? null,
    wardrobe: { worn: pet.wardrobe?.worn ?? prevState?.wardrobe?.worn ?? [] },
    // The open care-alert issue (see github/alerts.js); undefined means alerts did not run.
    alert: pet.alert !== undefined ? pet.alert : prevState?.alert ?? null,
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
  if (pet.facts.commits1 > 0) parts.push(tr.diary.ate(pet.facts.commits1));
  else parts.push(pet.vacation ? tr.diary.vacation(pet.vacation.until) : tr.diary.fasted);
  if (pet.events.includes('rankUp')) parts.push(tr.diary.rankUp(pet.level, `${pet.rank.emoji} ${tr.ranks[pet.rank.id]}`));
  else if (pet.events.includes('levelUp')) parts.push(tr.diary.levelUp(pet.level));
  if (pet.events.includes('evolved') && pet.path) parts.push(tr.diary.evolved(`${pet.path.emoji} ${tr.paths[pet.path.id]}`));
  const quests = pet.quests?.list.filter((q) => q.isNew) ?? [];
  if (quests.length) parts.push(tr.diary.quests(quests.map((q) => `${q.emoji} ${tr.quests[q.id](q.goal)}`).join(', ')));
  if (pet.events.includes('perfectWeek')) parts.push(tr.diary.perfectWeek);
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
