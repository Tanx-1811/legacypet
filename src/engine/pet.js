import { strings, resolveLang } from '../i18n/index.js';
import { pickHome, pickSpecies } from '../sprites/index.js';
import { createRng } from '../util/rng.js';
import { DAY, isoDay } from '../util/time.js';
import { evaluateAchievements } from './achievements.js';
import { holidayFor, seasonFor } from './calendar.js';
import { applyCare, careBonus } from './care.js';
import { applyPathBonus, evolve, pathById } from './evolution.js';
import { isShiny, petName } from './identity.js';
import { AURA_DAYS, blissStreak, chooseAccessories, deriveMood } from './mood.js';
import { itemById, parseWear, resolveWear, unlockedItems, wearCommand } from './items.js';
import { cleanMotto, parseColor } from './look.js';
import { VITALS } from './memory.js';
import { evaluateQuests, questJoy } from './quests.js';
import { levelEvents, levelProgress, rankFor } from './rank.js';
import { chooseSpeech } from './speech.js';
import { activeVacation, lastDay, parseVacation, resolveVacations, vacationDays } from './vacation.js';
import { computeFacts, computeGrowth, computeVitals } from './vitals.js';

// Turns a repo snapshot (plus the pet's memory from last run) into everything
// needed to draw it. Pure: the same inputs always give the same pet.
//
// options: species, name, lang, scenery (the pet's home; auto = the species' own),
//          color (a coat color from engine/look.js, or a hex), motto (a catchphrase for good days),
//          vacation (the input, e.g. "until 2027-01-05"), vacationCommand ({ name: 'vacation', days } | { name: 'back' }),
//          wear (the input, e.g. "cap, bird"), wearCommand (the argument of `/pet wear`),
//          care ({ name: 'feed' | 'play' | 'pat', user } from a `/pet` comment),
//          plus preview-only overrides (shiny, mood, stage, holiday, season, aura, levelUp: true | 'rank',
//          path, unlockAll: wear locked items) used by the gallery, demos and the playground.
export function buildPet({ snapshot, prevState = null, options = {}, now = new Date() }) {
  const lang = resolveLang(options.lang);
  const tr = strings(lang);
  const fullName = snapshot.repo.fullName;
  const tint = parseColor(options.color);
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
  const history = prevState?.history ?? [];

  // Boosts the pet earned by playing: its evolution path, quests finished earlier this week
  // and today's snacks and games. They count before the mood is chosen.
  const evolution = evolve({
    stage: growth.stage, history, prev: prevState?.evolution, preview: options.path, date, snapshot, facts,
  });
  applyPathBonus(vitals, evolution);
  vitals.joy = Math.min(100, vitals.joy + questJoy(prevState?.quests, now));
  const moodOf = () => (options.mood
    ? { mood: options.mood, events: [] }
    : deriveMood({ snapshot, facts, vitals, growth, modifiers, prevState, now, holiday }));
  const { care, outcome: careOutcome } = applyCare({
    prev: prevState?.care, action: options.care, date, mood: options.care ? moodOf().mood : null,
  });
  const bonus = careBonus(care, date);
  for (const key of ['fullness', 'energy', 'joy']) vitals[key] = Math.min(100, vitals[key] + bonus[key]);

  const derived = moodOf();
  const { mood, events } = derived;
  if (mood !== 'egg') {
    const leveled = options.levelUp ? ['levelUp', ...(options.levelUp === 'rank' ? ['rankUp'] : [])] : levelEvents(prevState, growth.level);
    events.push(...leveled);
  }
  if (mood === 'egg') growth.stage = 'egg';
  if (evolution?.fresh && mood !== 'egg') events.push('evolved');

  const quests = evaluateQuests({
    snapshot, history, prev: prevState?.quests, stars: prevState?.questStars ?? 0, fullName, now,
    today: { date, mood, vitals: VITALS.map((k) => vitals[k] ?? null) },
  });
  if (quests.fresh.length) events.push('questDone');
  if (quests.perfect && quests.earned > quests.fresh.length) events.push('perfectWeek');

  const auraDays = blissStreak(mood, date, prevState?.history);
  const aura = options.aura ?? auraDays >= AURA_DAYS;
  const shiny = options.shiny ?? isShiny(fullName);
  const home = vacation ? 'beach' : pickHome(options.scenery, species);
  const name = options.name?.trim() || petName(fullName);
  const achievements = evaluateAchievements(
    { snapshot, facts, vitals, growth, events, shiny, mood, aura, quests, evolution, care },
    prevState?.achievements ?? {},
    date,
  );

  // The wardrobe: the `wear` input is the source of truth when set; otherwise `/pet wear`
  // changes what the pet wore last time.
  const progress = { achievements: achievements.map, stars: quests.stars, friends: care.total };
  const previousWear = prevState?.wardrobe?.worn ?? [];
  const requested = parseWear(options.wear) ?? (options.wearCommand != null ? wearCommand(previousWear, options.wearCommand) : previousWear);
  const wardrobe = { ...resolveWear(requested, progress, { all: options.unlockAll }), unlocked: unlockedItems(progress) };
  const accessories = dress(chooseAccessories({ mood, holiday, events, growth, facts, vitals, species }), wardrobe.worn, mood);
  if (vacation && mood !== 'egg' && mood !== 'zombie') accessories.face = 'sunglasses';

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
    tint,
    motto: cleanMotto(options.motto),
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
    evolution: evolution ? { path: evolution.path, since: evolution.since } : null,
    path: evolution ? pathById(evolution.path) : null,
    quests,
    questStars: quests.stars,
    care,
    careOutcome,
    wardrobe,
  };
  pet.speech = chooseSpeech(pet, snapshot, tr, createRng(`${fullName}|${date}|speech`));
  return pet;
}

// Hats that tell you something about today beat the hat the pet was dressed in.
const SITUATIONAL_HATS = new Set(['party', 'witch', 'santa', 'nightcap', 'icepack']);
const FACE_GEAR = { shades: 'sunglasses', glasses: 'glasses', monocle: 'monocle' };

function dress(accessories, worn, mood) {
  const out = { ...accessories, pal: null };
  if (mood === 'egg') return out;
  for (const id of worn) {
    const { slot } = itemById(id);
    if (slot === 'face') out.face = FACE_GEAR[id];
    else if (slot === 'pal') out.pal = id;
    else if (!SITUATIONAL_HATS.has(out.hat)) out.hat = id;
  }
  return out;
}
