# Changelog

Every release of LegacyPet. `@v1` always points to the newest 1.x release, so pets update on their own;
the first run on a new version also lists these notes in the job summary.
Releases that need a change to your workflow file say so.

## 1.2.0 (2026-10-08)

### New

- 🏖️ **Vacation mode**: `vacation: until 2027-01-05` (or comment `/pet vacation 14`, and `/pet back` to return early).
  Hunger pauses, vacation days never count, and the pet relaxes on the beach in sunglasses. Up to 60 days.
- 🚨 **Care alerts** (opt-in, `alerts: true`): one issue when the pet stays sick or turns zombie, kept up to date and
  closed automatically when it recovers. Waits for two runs in a row, and closing it by hand mutes it.
- 📈 **`pet-stats.svg`**: a 30-day chart of fullness, health, joy and energy, with each day's mood. `pet.json` history now keeps daily vitals.
- 🏆 **`/pet trophies`**: the trophy shelf, with unlock dates and what's still locked.
- 🌄 **Livelier scenes**: rainbows, shooting stars, northern lights, party bunting, zombie fog, Halloween bats,
  Christmas lights and a snowman, and a blooming mai branch at Tết.
- 🕺 **Signature moves**: on good days every species shows off its own move every few seconds: the slime squishes,
  the crab sidesteps, the ninja dashes and leaves two shadow clones, the mecha hovers on its jets, the bunny twirls,
  the bat does a backflip and the super pup takes off. Off when the pet feels bad, and with reduced motion.
- 📤 **New outputs**: `on-vacation`, `alert-issue`.

### Workflow

Nothing to change. Alerts use the `issues: write` permission that `/pet` already needs.

## 1.1.0 (2026-10-08)

### New

- 🦸 **The hero squad**: 6 new species inspired by anime and superhero cartoons, each with a brand-new trait.
  Ninja Fox (`ninja`), Mecha (`mecha`), Spirit Dragon (`dragon`), Magical Bunny (`bunny`), Night Guardian (`bat`) and Super Pup (`hero`).
- 🏞️ **Homes**: every species lives in its own animated place (meadow, garden, pond, beach, reef, jungle, desert).
  Move your pet with the new `scenery` input.
- 🌍 **5 new languages**: 日本語 (`ja`), 中文 (`zh`), 한국어 (`ko`), Español (`es`), Français (`fr`).
  Chinese, Japanese and Korean wrap correctly in the speech bubble, and missing lines fall back to English.
- 💬 **`/pet` command**: comment `/pet`, `/pet pat`, `/pet checkup` or `/pet help` on any issue or PR and the pet answers.
- 💥 **Super form**: 7 ecstatic days in a row unlock a golden aura.
- 🏆 **New trophies**: Super Form, First Responder and Anniversary.
- 🛡️ **`pet-shields.json`**: a shields.io endpoint badge. The pet branch's README shows a 14-day mood chart.
- 📤 **New outputs**: `previous-mood`, `mood-changed`, `aura`, `new-trophies`.
- 🆕 **What's new notices**: the first run on a new version lists the changes in the job summary.

### Changed

- Pets that already hatched keep their species, even though the pool grew from 7 to 13.

### Workflow update needed for `/pet`

Add the `issue_comment` trigger, the `issues: write` and `pull-requests: write` permissions and the job's `if:` line
from [examples/legacypet.yml](examples/legacypet.yml), or run `npx github:Tanx-1811/legacypet init --force`.
Everything else works without changes.

## 1.0.0 (2026-10-08)

- 🐾 First release: a pixel pet fed by commits, healed by green CI and cheered up by answered issues.
- 7 species, 10 moods, life stages, shiny pets, 14 trophies, seasons and holidays, night mode.
- A diary, a checkup, a Pet Park for profile READMEs, and a CLI with `init`, `render`, `park` and `demo`.
- English and Vietnamese.
