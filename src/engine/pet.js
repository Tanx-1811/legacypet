import { strings, resolveLang } from '../i18n/index.js';
import { pickHome, pickSpecies } from '../sprites/index.js';
import { createRng } from '../util/rng.js';
import { DAY, isoDay } from '../util/time.js';
import { evaluateAchievements } from './achievements.js';
import { holidayFor, seasonFor } from './calendar.js';
import { isShiny, petName } from './identity.js';
import { AURA_DAYS, blissStreak, chooseAccessories, deriveMood } from './mood.js';
import { levelEvents, levelProgress, rankFor } from './rank.js';
import { chooseSpeech } from './speech.js';
import { activeVacation, lastDay, parseVacation, resolveVacations, vacationDays } from './vacation.js';
import { computeFacts, computeGrowth, computeVitals } from './vitals.js';

// Turns a repo snapshot (plus the pet's memory from last run) into everything
// needed to draw it. Pure: the same inputs always give the same pet.
//
// options: species, name, lang, scenery (the pet's home; auto = the species' own),
//          vacation (the input, e.g. "until 2027-01-05"), vacationCommand ({ name: 'vacation', days } | { name: 'back' }),
//          plus preview-only overrides (shiny, mood, stage, holiday, season, aura, levelUp: true | 'rank')
//          used by the gallery and demos.
export function buildPet({ snapshot, prevState = null, options = {}, now = new Date() }) {
  const lang = resolveLang(options.lang);
  const tr = strings(lang);
  const fullName = snapshot.repo.fullName;
  const species = pickSpecies({
    requested: options.species, fullName, language: snapshot.repo.language, previous: prevState?.pet?.species,
  });
  const modifiers = species.modifiers ?? {};
  const date = isoDay(now);

  const facts = computeFacts(snapshot, now);
  const vacations = resolveVacations({
    previous: prevState?.vacations ?? [], spec: parseVacation(options.vacation), command: options.vacationCommand, today: date,
  });
  const vacation = activeVacation(vacations, date);
  facts.hungerDays = Math.max(0, facts.daysSinceCommit - vacationDays(vacations, now.getTime() - facts.daysSinceCommit * DAY, now));
  const vitals = computeVitals(snapshot, facts, modifiers, now);
  if (vacation) {
    // Nobody expects commits or replies from someone on the beach.
    vitals.joy = Math.max(vitals.joy, 60);
    vitals.energy = Math.max(vitals.energy, 50);
  }
  const growth = computeGrowth(facts, modifiers);
  if (options.stage) growth.stage = options.stage;
  const holiday = options.holiday !== undefined ? options.holiday : holidayFor(now);
  const season = options.season ?? seasonFor(now);

  const derived = options.mood
    ? { mood: options.mood, events: [] }
    : deriveMood({ snapshot, facts, vitals, growth, modifiers, prevState, now, holiday });
  const { mood, events } = derived;
  if (mood !== 'egg') {
    const leveled = options.levelUp ? ['levelUp', ...(options.levelUp === 'rank' ? ['rankUp'] : [])] : levelEvents(prevState, growth.level);
    events.push(...leveled);
  }
  if (mood === 'egg') growth.stage = 'egg';

  const auraDays = blissStreak(mood, date, prevState?.history);
  const aura = options.aura ?? auraDays >= AURA_DAYS;
  const shiny = options.shiny ?? isShiny(fullName);
  const home = vacation ? 'beach' : pickHome(options.scenery, species);
  const name = options.name?.trim() || petName(fullName);
  const accessories = chooseAccessories({ mood, holiday, events, growth, facts, vitals, species });
  if (vacation && mood !== 'egg' && mood !== 'zombie') accessories.face = 'sunglasses';
  const achievements = evaluateAchievements(
    { snapshot, facts, vitals, growth, events, shiny, mood, aura },
    prevState?.achievements ?? {},
    date,
  );

  const pet = {
    repo: { fullName, owner: snapshot.repo.owner, name: snapshot.repo.name },
    lang,
    date,
    generatedAt: now.toISOString(),
    name,
    title: tr.titles[mood],
    displayName: tr.displayName(name, tr.titles[mood]),
    species,
    speciesId: species.id,
    shiny,
    home,
    stage: growth.stage,
    level: growth.level,
    rank: rankFor(growth.level),
    progress: levelProgress({ level: growth.level, totalCommits: facts.totalCommits }, modifiers),
    xp: growth.xp,
    hatchProgress: growth.hatchProgress,
    mood,
    events,
    eventDates: { ...(prevState?.events ?? {}), ...Object.fromEntries(events.map((e) => [e, date])) },
    holiday,
    season,
    vitals,
    facts,
    accessories,
    aura,
    auraDays,
    vacation: vacation ? { from: vacation.from, until: lastDay(vacation) } : null,
    vacations,
    achievements: achievements.list,
    achievementsMap: achievements.map,
    newAchievements: achievements.fresh,
  };
  pet.speech = chooseSpeech(pet, snapshot, tr, createRng(`${fullName}|${date}|speech`));
  return pet;
}
