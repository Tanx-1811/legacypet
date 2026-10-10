# Changelog

Every release of LegacyPet. `@v1` always points to the newest 1.x release, so pets update on their own;
the first run on a new version also lists these notes in the job summary.
Releases that need a change to your workflow file say so.

## 1.3.0 (unreleased)

### New

- 🖥️ **The LegacyPet app**: every project on your computer gets a pet. Download it for macOS, Windows or Linux
  (or run `npx github:Tanx-1811/legacypet app`), allow it to look in your project folders, and it finds every git repo
  and raises a pet for each one, offline, from your own commits. Adopt a pet on GitHub with one click (it commits just
  the workflow and the README pet and pushes), or all of them at once. Feed, play and pat them, see what needs care,
  and get notified when a pet gets hungry or levels up. The desktop app adds a menu bar icon and a pet that sits on your desktop.
  No account and no tracking: it reads only the folders you allow and talks to GitHub only when you turn on *GitHub details*.
- 📊 **A dashboard in the app**: stat tiles, a year of commits on one activity calendar, the busiest repos this week and
  the streaks at risk (plus an evening reminder before a streak ends). Each pet's page has tabs for its activity
  (calendar, recent commits), quests and trophies, and its look; pin pets, sort them, or switch to a list.
- ⌨️ **⌘K / Ctrl+K**: a command palette for every page, pet and action. Open a project in your code editor or a terminal
  from its page, and bring the desktop app up from anywhere with ⌘⇧L / Ctrl+Shift+L.
- 🎨 **A new look**: a cleaner design with Lucide icons, a sidebar that folds into icons, scrolling tabs on phones,
  and a download page for the app.
- 🐣 **A logo of its own**: a pet that just hatched, still wearing a piece of its eggshell, in LegacyPet's new teal.
  It's on the playground, the app and tray icons, and the corner of every pet card.
- 📜 **Weekly quests**: three goals a week, picked from what the repo really does (commit days, CI, replies, merged PRs,
  releases, teamwork, happy days, nothing stale). Each finished quest earns a quest star and +5 joy until Monday;
  all three earn two more. Shown on the card, in the diary, the job summary and `/pet quests`.
- 🧬 **Evolution**: after a week as an adult, the pet takes a permanent path that mirrors how the repo is cared for
  (Swift, Guardian, Social or Sage), with a floating emblem (glowing on elders) and +6 to the matching vital.
- 👗 **Wardrobe**: 16 hats, face items and pals, unlocked by trophies, quest stars and friends.
  Dress up with the new `wear` input or `/pet wear <item>`; `/pet wardrobe` shows everything.
- 🍪 **Snacks and games**: `/pet feed` and `/pet play` (plus `/pet pet`, `/pet hug`, `/pet snack` as aliases).
  A small boost for the day, once a day per person and capped, and the pet remembers its best friends.
- 🏆 **New trophies**: Quester, Perfect Week, Evolved and Beloved (24 in total). A full shelf keeps the newest trophies and shows `+N`.
- 🕹️ **The playground is now an app**: Hatch, Raise (a day-by-day simulator with feeding, playing, dressing up,
  autoplay habits and a `/pet` console), Codex, Park builder and Adopt, in English and Vietnamese, with light/dark themes,
  keyboard shortcuts and choices that carry over between views.
- 📤 **New outputs**: `path`, `quest-stars`, `quests-done`, `wearing`, `color`. The CLI demo takes `--wear` and `--path`.
- 🎨 **Colors and catchphrases**: `color: teal` repaints the pet (12 colors, silver, or any hex color; eyes and each
  species' own details keep theirs), and `motto: "Ship it, {name}!"` gives it a catchphrase for good days.
  Both work in the CLI (`--color`, `--motto`), the playground and the app.
- 🧑‍🎨 **A Customize tab worth the name**: name (with a random-name dice), species, coat color, catchphrase, home,
  card theme and the whole wardrobe for each pet, with a live preview and a reset button.
- 🧰 **Tools on each pet's page**: download the card, mini card or badge as SVG or PNG, copy the README or badge
  Markdown, keep notes for the project, and `git fetch` / `git pull --ff-only` from the app.
- 🔔 **More settings**: choose which news notifies you (moods, growth, rewards, streaks), the streak reminder hour
  (or none), quiet hours, the desktop pet's size and whether it speaks up on its own. **Care for all** feeds, plays
  with or pats every pet at once (also in ⌘K).
- 💾 **Backup & restore**: one JSON file with your settings, notes and every pet's memory (never the token). On another
  computer each pet finds its repo again by its GitHub name.
- 🏮 **The anime crew: 30 new species** (43 in all), original characters from Japanese folklore and anime archetypes:
  Ronin Shiba, Nine-Tailed Fox, Leaf Tanuki, Little Oni, Kappa, Crow Tengu, Dream Eater, Lucky Cat, Daruma,
  Forest Spirit, Yurei, Star Idol, Little Witch, Isekai Knight, Stone Golem, Phoenix Chick, Monk Panda, Mini Kaiju,
  Shark Pup, Ice Penguin, Axolotl, Frog Prince, Owl Sage, Monkey King, Space Cadet, Little Vampire, Thunder Pup,
  Captain Otter, Sakura Sprite and Mimic. Each has its own trait, signature move and catchphrases in all 7 languages.
  New trait rules: energy and joy floors, faster charging, daily training, release energy, team and streak joy,
  a bonus for fresh PRs, a tidy community profile or an old repo. Pets that already hatched keep their species.

### Changed

- The command hint under each `/pet` reply lists just the command names; `/pet help` explains them.
- A typo in a workflow input (an unknown species, home or color) no longer breaks the pet in the app: the option is skipped.

### Fixed

- The app showed an empty page when opened or reloaded straight on Settings.
- `legacypet demo` ignored `--wear` and `--path`.

### Workflow

Nothing to change. `wear`, `color` and `motto` are optional.

## 1.2.1 (2026-10-08)

### Fixed

- 🐛 The speech bubble on the card and the name tags in the Pet Park floated up and faded every few seconds.
  They shared a CSS class with the reef's rising bubbles. (Since 1.1.0.)

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
- 🏅 **Levels and ranks**: every level-up is an event, with a LEVEL UP! banner over the pet, its own speech line and a diary entry.
  Levels are grouped into 7 ranks (🌱 Rookie, 🥉 Bronze, 🥈 Silver, 🥇 Gold, 💠 Platinum, 💎 Diamond, 👑 Legend), shown on the card
  and the badge, and each rank tints the XP bar. `/pet level` shows what the next level and rank take.
  New trophies: Veteran (Lv.25), Master (Lv.50) and Max Level (Lv.99).
- 🕺 **Signature moves**: on good days every species shows off its own move every few seconds: the slime squishes,
  the crab sidesteps, the ninja dashes and leaves two shadow clones, the mecha hovers on its jets, the bunny twirls,
  the bat does a backflip and the super pup takes off. Off when the pet feels bad, and with reduced motion.
- 📤 **New outputs**: `on-vacation`, `alert-issue`, `level-up`, `rank`.

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
