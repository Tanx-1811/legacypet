import { AURA_DAYS } from './mood.js';

// The pet talks about what is really happening in the repo.
// Strong moods and events speak first; calmer days mix in data-aware tidbits.

export function speechVars(pet, snapshot) {
  const { facts } = pet;
  const oldest = snapshot.issues?.unanswered?.[0];
  const treat = snapshot.treats?.[0];
  return {
    name: pet.name,
    repo: snapshot.repo.fullName,
    repoName: snapshot.repo.name,
    days: Math.floor(facts.daysSinceCommit),
    commits7: facts.commits7,
    streak: facts.streak,
    stale: (snapshot.issues?.stale ?? 0) + (snapshot.issues?.stalePRs ?? 0),
    issue: oldest?.number,
    issueDays: oldest?.days,
    treatUser: treat?.user,
    treatPr: treat?.number,
    tag: snapshot.release?.tag,
    years: Math.max(1, Math.round(facts.ageDays / 365.25)),
    check: snapshot.ci?.failingNames?.[0],
    toHatch: Math.max(1, 5 - facts.totalCommits),
    auraDays: pet.auraDays,
    level: pet.level,
    rankEmoji: pet.rank?.emoji,
    until: pet.vacation?.until,
  };
}

export function chooseSpeech(pet, snapshot, tr, rng) {
  const fresh = pet.quests?.list.find((q) => q.isNew);
  const v = {
    ...speechVars(pet, snapshot),
    rank: tr.ranks?.[pet.rank?.id],
    path: pet.path ? `${pet.path.emoji} ${tr.paths[pet.path.id]}` : '',
    quest: fresh ? tr.quests[fresh.id](fresh.goal) : '',
    stars: pet.questStars ?? 0,
  };
  const say = (line) => (typeof line === 'function' ? line(v) : line);
  const pick = (lines) => say(rng.pick(lines));
  const { lines } = tr;
  const { mood, events, holiday } = pet;

  if (events.includes('revived')) return pick(lines.revived);
  if (events.includes('hatched')) return pick(lines.hatched);
  if (mood === 'hibernating' || mood === 'egg') return pick(lines.moods[mood]);
  if (mood === 'zombie') return pick(holiday === 'halloween' ? lines.holiday.halloweenZombie : lines.moods.zombie);
  if (mood === 'sick') return pick(v.check ? lines.ciFailing : lines.moods.sick);
  if (pet.vacation) return pick(lines.vacation);
  if (holiday && lines.holiday[holiday]) return pick(lines.holiday[holiday]);
  if (events.includes('birthday')) return pick(lines.birthday);
  if (events.includes('release') && v.tag) return pick(lines.release);
  if (events.includes('evolved') && v.path) return pick(lines.evolved);
  if (events.includes('rankUp')) return pick(lines.rankUp);
  if (events.includes('perfectWeek') && mood !== 'hungry' && mood !== 'sad') return pick(lines.perfectWeek);
  if (events.includes('levelUp') && ['happy', 'ecstatic', 'party', 'sleepy'].includes(mood)) return pick(lines.levelUp);
  if (pet.aura && pet.auraDays === AURA_DAYS) return pick(lines.aura); // the day it powers up

  // A hungry pet talks about food; a content one has room for small talk.
  const chatty = mood === 'happy' || mood === 'ecstatic';
  const pool = [...lines.moods[mood]];
  if (v.issue && (chatty || mood === 'sad' || mood === 'sleepy')) pool.push(...lines.issueNudge);
  if (v.treatUser && (chatty || mood === 'party')) pool.push(...lines.treat);
  if (v.streak >= 3 && chatty) pool.push(...lines.streak);
  if (snapshot.ci?.state === 'unknown' && (chatty || mood === 'sleepy')) pool.push(...lines.noCi);
  if (pet.aura) pool.push(...lines.aura);
  if (v.quest && (chatty || mood === 'party')) pool.push(...lines.questDone);
  if (pet.path && chatty) pool.push(...(lines.paths?.[pet.path.id] ?? []));
  if (chatty || mood === 'party') pool.push(...(lines.species?.[pet.speciesId] ?? []));
  return pick(pool);
}
