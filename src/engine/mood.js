import { daysBetween, isoDay } from '../util/time.js';
import { isBirthday, PARTY_HOLIDAYS } from './calendar.js';
import { THRESHOLDS, withDefaults } from './vitals.js';

export const MOODS = ['ecstatic', 'happy', 'party', 'hungry', 'sleepy', 'sad', 'sick', 'zombie', 'hibernating', 'egg'];

export const MOOD_EMOJI = {
  ecstatic: '🤩', happy: '😊', party: '🥳', hungry: '🍖', sleepy: '😴',
  sad: '🥺', sick: '🤒', zombie: '🧟', hibernating: '💤', egg: '🥚',
};

// Moods are checked in priority order: the first one that applies wins.
export function deriveMood({ snapshot, facts, vitals, growth, modifiers, prevState, now, holiday }) {
  const m = withDefaults(modifiers);
  const today = isoDay(now);
  const events = [];
  const happenedToday = (name) => prevState?.events?.[name] === today;

  if (snapshot.repo.archived) return { mood: 'hibernating', events };

  if ((prevState?.lastStage === 'egg' && growth.stage !== 'egg') || happenedToday('hatched')) events.push('hatched');
  if (growth.stage === 'egg') return { mood: 'egg', events };

  const isZombie = facts.daysSinceCommit * m.hungerRate >= THRESHOLDS.zombieDays;
  if ((prevState?.lastMood === 'zombie' && !isZombie) || happenedToday('revived')) events.push('revived');
  if (prevState?.lastMood === 'sick' && vitals.health >= THRESHOLDS.sick) events.push('recovered');
  if (isZombie) return { mood: 'zombie', events };
  if (events.includes('revived') || events.includes('hatched')) return { mood: 'party', events };
  if (vitals.health < THRESHOLDS.sick) return { mood: 'sick', events };

  const release = snapshot.release;
  if (release && daysBetween(release.publishedAt, now) <= THRESHOLDS.partyDays) events.push('release');
  if (isBirthday(snapshot.repo.createdAt, now)) events.push('birthday');
  if (events.includes('release') || events.includes('birthday') || PARTY_HOLIDAYS.has(holiday)) {
    return { mood: 'party', events };
  }

  if (vitals.fullness < THRESHOLDS.hungry) return { mood: 'hungry', events };
  if (vitals.joy < THRESHOLDS.sad) return { mood: 'sad', events };
  if (vitals.energy < THRESHOLDS.sleepy) return { mood: 'sleepy', events };
  const score = (vitals.fullness + vitals.health + vitals.joy + vitals.energy) / 4;
  return { mood: score >= THRESHOLDS.ecstatic ? 'ecstatic' : 'happy', events };
}

export function chooseAccessories({ mood, holiday, events, growth, facts, vitals, species }) {
  let hat = null;
  if (mood === 'egg') hat = null;
  else if (mood === 'party' || events.includes('birthday')) hat = 'party';
  else if (holiday === 'halloween') hat = 'witch';
  else if (holiday === 'christmas') hat = 'santa';
  else if (mood === 'hibernating' || mood === 'sleepy') hat = 'nightcap';
  else if (mood === 'sick') hat = 'icepack';
  else if (facts.stars >= 1000) hat = 'crown';
  else if (mood === 'ecstatic' && species.id === 'cactus') hat = 'flower';
  else if (growth.stage === 'baby') hat = 'sprout';

  let face = null;
  if (mood !== 'egg') {
    if (growth.stage === 'elder') face = 'monocle';
    else if ((vitals.hygiene ?? 0) >= 90 && mood !== 'zombie') face = 'glasses';
  }
  return { hat, face };
}
