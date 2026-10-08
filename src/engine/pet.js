import { strings, resolveLang } from '../i18n/index.js';
import { pickSpecies } from '../sprites/index.js';
import { createRng } from '../util/rng.js';
import { isoDay } from '../util/time.js';
import { evaluateAchievements } from './achievements.js';
import { holidayFor, seasonFor } from './calendar.js';
import { isShiny, petName } from './identity.js';
import { chooseAccessories, deriveMood } from './mood.js';
import { chooseSpeech } from './speech.js';
import { computeFacts, computeGrowth, computeVitals } from './vitals.js';

// Turns a repo snapshot (plus the pet's memory from last run) into everything
// needed to draw it. Pure: the same inputs always give the same pet.
//
// options: species, name, lang, plus preview-only overrides
//          (shiny, mood, stage, holiday, season) used by the gallery and demos.
export function buildPet({ snapshot, prevState = null, options = {}, now = new Date() }) {
  const lang = resolveLang(options.lang);
  const tr = strings(lang);
  const fullName = snapshot.repo.fullName;
  const species = pickSpecies({ requested: options.species, fullName, language: snapshot.repo.language });
  const modifiers = species.modifiers ?? {};
  const date = isoDay(now);

  const facts = computeFacts(snapshot, now);
  const vitals = computeVitals(snapshot, facts, modifiers, now);
  const growth = computeGrowth(facts);
  if (options.stage) growth.stage = options.stage;
  const holiday = options.holiday !== undefined ? options.holiday : holidayFor(now);
  const season = options.season ?? seasonFor(now);

  const derived = options.mood
    ? { mood: options.mood, events: [] }
    : deriveMood({ snapshot, facts, vitals, growth, modifiers, prevState, now, holiday });
  const { mood, events } = derived;
  if (mood === 'egg') growth.stage = 'egg';

  const shiny = options.shiny ?? isShiny(fullName);
  const name = options.name?.trim() || petName(fullName);
  const accessories = chooseAccessories({ mood, holiday, events, growth, facts, vitals, species });
  const achievements = evaluateAchievements(
    { snapshot, facts, vitals, growth, events, shiny, mood },
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
    stage: growth.stage,
    level: growth.level,
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
    achievements: achievements.list,
    achievementsMap: achievements.map,
    newAchievements: achievements.fresh,
  };
  pet.speech = chooseSpeech(pet, snapshot, tr, createRng(`${fullName}|${date}|speech`));
  return pet;
}
