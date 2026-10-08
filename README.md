<div align="center">

# 🐾 LegacyPet

**Your repo has a pet. Don't let it become a zombie.**

A pixel pet that lives in your README and feels exactly how your project is doing:
fed by commits, healed by green CI, cheered up when issues get answered.

[![Our own pet](https://raw.githubusercontent.com/Tanx-1811/legacypet/legacypet/pet-badge.svg)](https://github.com/Tanx-1811/legacypet/blob/legacypet/DIARY.md)
[![CI](https://github.com/Tanx-1811/legacypet/actions/workflows/ci.yml/badge.svg)](https://github.com/Tanx-1811/legacypet/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

[English](README.md) · [Tiếng Việt](README.vi.md) · **[🔮 Preview your repo's pet](https://tanx-1811.github.io/legacypet/)**

<img src="docs/gallery/hero/hero.svg" alt="Mochi the Radiant, an ecstatic rubber duck wearing a crown" width="520">

**🆕 New in 1.1:** [the hero squad](#-the-hero-squad) · [7 languages](#it-talks-about-your-repo) · [`/pet` command](#talk-to-your-pet-pet) · [super form](#-super-form) · [homes](#homes) · [full changelog](CHANGELOG.md)

</div>

## Why

Everyone who lands on your repo asks the same question: **is this project alive?**
Stars don't answer it. Commit graphs take effort to read. A pet answers it in one glance,
and gives you a small, silly reason to come back and care for your code.

- 🍖 **Commits feed it.** Stop pushing and it gets hungry. Six months later it rises from the grave.
- ❤️ **CI keeps it healthy.** A red build gives it a fever and an ice pack.
- 😊 **Issues make it happy or sad.** Leave people unanswered and a rain cloud follows it around.
- 🎉 **Releases throw a party.** Confetti, a party hat, and a shout-out to your contributors.
- 📔 **It keeps a diary** of every day of your project's life.
- 🩺 **It gives you a checkup**: what's wrong, and exactly what would help.
- 💬 **It talks back.** Comment `/pet` on an issue or PR and it answers, in 7 languages.
- 🦸 **13 species to adopt**, from a rubber duck to a ninja fox, each living in its own animated home.
- 🏞️ **All your pets meet in a Pet Park** on your profile README.

Everything runs inside a GitHub Action: no server, no sign-up, no tracking, zero dependencies.

## Quick start

### 1. Preview it (optional)

Open the **[playground](https://tanx-1811.github.io/legacypet/)**, type any `owner/repo`
and see which pet it hatches, plus a checkup. Then share the link and show off. 🔮

### 2. Adopt it with one command

Inside your repository:

```sh
npx github:Tanx-1811/legacypet init
```

This adds `.github/workflows/legacypet.yml`, puts the pet at the top of your `README.md`
and shows a preview right in your terminal. Then:

```sh
git add . && git commit -m "Adopt a LegacyPet 🐾" && git push
```

Run the workflow once from the **Actions** tab (or wait for the schedule) and refresh your README. Hello, pet!

Options: `--lang ja`, `--species ninja`, `--scenery beach`, `--name Mochi`, `--style badge`. In a profile repo (`you/you`) it sets up a [Pet Park](#pet-park) instead.

### …or by hand

Add [`.github/workflows/legacypet.yml`](examples/legacypet.yml):

```yaml
name: LegacyPet
on:
  schedule:
    - cron: '17 */6 * * *'
  release:
    types: [published]
  workflow_dispatch:
  issue_comment:
    types: [created] # talk to your pet with /pet

permissions:
  contents: write # publish the pet to the `legacypet` branch
  actions: write # keep the schedule alive while the repo sleeps
  issues: write # answer /pet in issues
  pull-requests: write # ...and in pull requests
  checks: read
  statuses: read

jobs:
  legacypet:
    if: github.event_name != 'issue_comment' || startsWith(github.event.comment.body, '/pet')
    runs-on: ubuntu-latest
    steps:
      - uses: Tanx-1811/legacypet@v1
```

Run it once from the **Actions** tab, then paste this into your README (replace `OWNER/REPO`):

```md
[![LegacyPet](https://raw.githubusercontent.com/OWNER/REPO/legacypet/pet.svg)](https://github.com/OWNER/REPO/blob/legacypet/DIARY.md)
```

The action also prints the exact snippet in its job summary.
Your pet lives on its own `legacypet` branch, so your main history stays clean.

### Pick a size

| File | Looks like | Best for |
| --- | --- | --- |
| `pet.svg` | the card above | the top of a project README |
| `pet-mini.svg` | <img src="docs/gallery/moods/happy.svg" width="70"> | sidebars, tables, profile READMEs |
| `pet-badge.svg` | <img src="docs/gallery/badges/ecstatic.svg"> | next to your other badges |
| `park.svg` | see [Pet Park](#pet-park) | your profile README |
| `pet-shields.json` | a [shields.io endpoint](https://shields.io/badges/endpoint-badge) | a badge row in shields.io style |

Swap the file name in the snippet to switch. The shields.io badge looks like this:

```md
![pet](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Flegacypet%2Fpet-shields.json)
```

## Moods

<table>
<tr>
<td align="center"><img src="docs/gallery/moods/ecstatic.svg" width="120"><br><b>Ecstatic</b></td>
<td align="center"><img src="docs/gallery/moods/happy.svg" width="120"><br><b>Happy</b></td>
<td align="center"><img src="docs/gallery/moods/party.svg" width="120"><br><b>Party</b></td>
<td align="center"><img src="docs/gallery/moods/hungry.svg" width="120"><br><b>Hungry</b></td>
<td align="center"><img src="docs/gallery/moods/sleepy.svg" width="120"><br><b>Sleepy</b></td>
</tr>
<tr>
<td align="center"><img src="docs/gallery/moods/sad.svg" width="120"><br><b>Sad</b></td>
<td align="center"><img src="docs/gallery/moods/sick.svg" width="120"><br><b>Sick</b></td>
<td align="center"><img src="docs/gallery/moods/zombie.svg" width="120"><br><b>Zombie</b></td>
<td align="center"><img src="docs/gallery/moods/hibernating.svg" width="120"><br><b>Hibernating</b></td>
<td align="center"><img src="docs/gallery/moods/egg.svg" width="120"><br><b>Egg</b></td>
</tr>
</table>

The first mood that applies wins:

| Mood | When |
| --- | --- |
| 💤 Hibernating | The repo is archived. It sleeps peacefully under the snow. |
| 🥚 Egg | Fewer than 5 commits. It cracks a little more with each one. |
| 🧟 Zombie | 180 days without a commit. Flies, a tombstone, and a craving for commits. |
| 🥳 Party | It just hatched, came back from the dead, you shipped a release in the last 3 days, or it's the repo's birthday, New Year, Tết or Programmers' Day. |
| 🤒 Sick | CI is failing on the default branch. |
| 🍖 Hungry | About 25 days without a commit. |
| 🥺 Sad | Issues and PRs are going stale or unanswered. |
| 😴 Sleepy | No commits in the last two weeks. |
| 🤩 Ecstatic | All vitals average 80 or more. |
| 😊 Happy | Everything else. Life is good. |

### Vitals

Every number on the card maps to a real maintenance habit:

| Vital | Measures | Formula |
| --- | --- | --- |
| 🍖 Fullness | Time since the last commit | `100 · e^(−days / 21)`, so 72 after a week and 24 after a month |
| ❤️ Health | CI on the latest default-branch commit | 100 when passing, 85 while running, 70 with no CI, low when failing |
| 😊 Joy | Care for issues and PRs | Drops with the share of stale items and each community issue waiting 7+ days for a first reply |
| ⚡ Energy | Commits in the last 14 days | `100 · (1 − e^(−commits / 6))` |
| 🧼 Hygiene | README, license, code of conduct… | GitHub's community profile score |

Issues opened by maintainers don't count as "unanswered", and bots never earn treats.
The pet only judges you on what visitors would care about.

## Species

Your repo picks its own pet. Rust repos always hatch a crab and Python repos a snake.
Everyone else gets one decided by the repo's name. Each species bends one rule:

| | Species | Trait | Effect |
| :-: | --- | --- | --- |
| <img src="docs/gallery/species/blob.svg" width="80"> | Slime | Adaptable | No strengths, no weaknesses. Perfectly balanced. |
| <img src="docs/gallery/species/cat.svg" width="80"> | Cat | Independent | Ignored issues hurt its joy only half as much. |
| <img src="docs/gallery/species/duck.svg" width="80"> | Rubber Duck | Debugger | Helps you debug, so failing CI hurts it 35% less. |
| <img src="docs/gallery/species/crab.svg" width="80"> | Crab | Molting | Grows a new shell with every release: +15 joy for two weeks. |
| <img src="docs/gallery/species/octopus.svg" width="80"> | Octopus | Multitasker | Eight arms love company: +6 energy per extra active contributor. |
| <img src="docs/gallery/species/snake.svg" width="80"> | Snake | Patient | Eats rarely, so hunger builds 40% slower. |
| <img src="docs/gallery/species/cactus.svg" width="80"> | Cactus | Drought-proof | Thrives on neglect: hunger builds 4× slower. Made for finished projects. |

### 🦸 The hero squad

Six original characters inspired by anime and Saturday-morning superhero cartoons. Each one brings a brand-new rule:

| | Species | Trait | Effect |
| :-: | --- | --- | --- |
| <img src="docs/gallery/species/ninja.svg" width="80"> | Ninja Fox (`ninja`) | Shadow Clone | Every day of your commit streak sends out a clone: +4 energy per day (up to +24). |
| <img src="docs/gallery/species/mecha.svg" width="80"> | Mecha (`mecha`) | Reactor Core | Green CI powers the reactor: energy never drops below 40 while CI passes. |
| <img src="docs/gallery/species/dragon.svg" width="80"> | Spirit Dragon (`dragon`) | Ancient Power | Has lived for millennia, so it levels up 50% faster. |
| <img src="docs/gallery/species/bunny.svg" width="80"> | Magical Bunny (`bunny`) | Starlight | Wishes on your stars: +2 joy per 100 stars (up to +20). |
| <img src="docs/gallery/species/bat.svg" width="80"> | Night Guardian (`bat`) | Vigilant | Patrols the issue tracker: +15 joy while no community issue waits for a reply. |
| <img src="docs/gallery/species/hero.svg" width="80"> | Super Pup (`hero`) | Steel Body | Shrugs off red builds: failing CI can't push its health below 40. |

They have their own catchphrases too ("Up, up and deploy! 🦸", "*poof* Shadow clone commit jutsu! 🍥").
Pets that already hatched keep their species when new ones join the pool.

Prefer a different one? Set `species: cactus`. Want a name? Set `name: Mochi`.
Otherwise the repo names its pet too. You don't choose, you adopt.

### ✨ Shiny pets

One repo in 64 hatches a **shiny** pet with different colors and a sparkle. There is no way to reroll.

<img src="docs/gallery/shiny/blob.svg" width="90"> <img src="docs/gallery/shiny/cat.svg" width="90"> <img src="docs/gallery/shiny/duck.svg" width="90"> <img src="docs/gallery/shiny/crab.svg" width="90"> <img src="docs/gallery/shiny/octopus.svg" width="90"> <img src="docs/gallery/shiny/snake.svg" width="90"> <img src="docs/gallery/shiny/cactus.svg" width="90">
<img src="docs/gallery/shiny/ninja.svg" width="90"> <img src="docs/gallery/shiny/mecha.svg" width="90"> <img src="docs/gallery/shiny/dragon.svg" width="90"> <img src="docs/gallery/shiny/bunny.svg" width="90"> <img src="docs/gallery/shiny/bat.svg" width="90"> <img src="docs/gallery/shiny/hero.svg" width="90">

### 💥 Super form

Keep your pet **ecstatic 7 days in a row** and it powers up: a golden aura, a 💥 Super Form trophy,
and a few words about it ("This isn't even my final form"). One bad day and the aura fades until the next streak.

<img src="docs/gallery/aura/ninja.svg" width="90"> <img src="docs/gallery/aura/mecha.svg" width="90"> <img src="docs/gallery/aura/dragon.svg" width="90"> <img src="docs/gallery/aura/bunny.svg" width="90"> <img src="docs/gallery/aura/bat.svg" width="90"> <img src="docs/gallery/aura/hero.svg" width="90">

## Homes

Every species lives somewhere of its own, and each place is alive:

<img src="docs/gallery/homes/meadow.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert.svg" width="100" alt="desert">

| Home | Who lives there | What's going on |
| --- | --- | --- |
| 🌳 Meadow | Slime, Super Pup | Rolling hills, a windmill turning on the far hill, a tree that changes with the seasons, butterflies |
| 🏡 Garden | Cat, Magical Bunny | A cottage whose window lights up at night, a picket fence, swaying sunflowers |
| 🦆 Pond | Rubber Duck | Glints on the water, ripples where a fish just jumped, cattails in the breeze |
| 🏖️ Beach | Crab | Waves rolling in, foam washing onto the sand, a swaying palm, seagulls, shells and a sandcastle |
| 🐠 Reef | Octopus | Underwater: sunbeams, swaying kelp, coral, rising bubbles and fish swimming by. Glowing plankton at night |
| 🌴 Jungle | Snake, Ninja Fox, Night Guardian | A waterfall, hanging vines, big fronds, mist, fireflies after dark |
| 🏜️ Desert | Cactus, Spirit Dragon, Mecha | Mesas, a heat haze over the dunes and a tumbleweed bouncing past |

At night (dark mode) the props dim, shooting stars streak across the sky and, in winter, the northern lights shimmer:

<img src="docs/gallery/homes/meadow-night.svg" width="100" alt="meadow"> <img src="docs/gallery/homes/garden-night.svg" width="100" alt="garden"> <img src="docs/gallery/homes/pond-night.svg" width="100" alt="pond"> <img src="docs/gallery/homes/beach-night.svg" width="100" alt="beach"> <img src="docs/gallery/homes/reef-night.svg" width="100" alt="reef"> <img src="docs/gallery/homes/jungle-night.svg" width="100" alt="jungle"> <img src="docs/gallery/homes/desert-night.svg" width="100" alt="desert">

The mood changes the place too: a rainbow comes out when the pet is ecstatic or partying, party days hang bunting,
and a zombie's world wilts, with bare trees, bats and a creeping fog.

Want your pet somewhere else? Set `scenery: beach` (or `--scenery beach` in the CLI).

## Growing up

<img src="docs/gallery/stages/egg.svg" width="110"> <img src="docs/gallery/stages/baby.svg" width="110"> <img src="docs/gallery/stages/adult.svg" width="110"> <img src="docs/gallery/stages/elder.svg" width="110">

**Egg** (under 5 commits) → **Baby** with a sprout (under 50 commits or a month old) → **Adult** → **Elder** with a monocle (3 years and 300+ commits).
The level is `√(all-time commits) + 1`, so Lv.11 at 100 commits and Lv.32 at 1,000.

## Trophies

Trophies are permanent. Once earned, they stay on the card even if the streak breaks.

| | Trophy | How |
| :-: | --- | --- |
| 🐣 | Hatched | Grow out of the egg |
| 🧟 | Back from the Dead | Feed a zombie |
| 🩹 | Survivor | Fix a failing CI |
| ✨ | Shiny! | Be one in 64 |
| 🔥 | On Fire | 7-day commit streak |
| ☄️ | Comet | 30-day commit streak |
| 💯 | Centurion | 100 commits |
| 🚀 | Shipper | Publish a release |
| ⭐ | Rising Star | 100 stars |
| 🌟 | Superstar | 1,000 stars (comes with a crown) |
| 🤝 | Squad | 10 contributors |
| 🧼 | Spotless | 100% community profile |
| 📭 | Inbox Zero | No open issues or PRs |
| 🧙 | Wise Elder | Reach the elder stage |
| 💥 | Super Form | Stay ecstatic 7 days in a row |
| 💌 | First Responder | Every community issue answered, with 5+ open |
| 🎂 | Anniversary | Celebrate the repo's birthday |

## Seasons, holidays and night mode

The scene follows the calendar: petals in spring, fireflies in summer, falling leaves in autumn, snow in winter.
In dark mode it's night, with a moon, twinkling stars, shooting stars and, in winter, the northern lights.

<img src="docs/gallery/holidays/halloween.svg" width="110"> <img src="docs/gallery/holidays/christmas.svg" width="110"> <img src="docs/gallery/holidays/tet.svg" width="110"> <img src="docs/gallery/holidays/newyear.svg" width="110"> <img src="docs/gallery/holidays/programmers.svg" width="110">

Halloween brings a witch hat, a pumpkin and bats, Christmas a Santa hat, a snowman and twinkling string lights, and New Year fireworks.
Tết (Lunar New Year) brings red lanterns and a blooming apricot (mai) branch shedding golden petals, and the 256th day of the year is Programmers' Day.

## It talks about your repo

The speech bubble isn't random filler. It reads the room:

> "My tummy hurts... "test (ubuntu-latest)" is failing 🤒"
> "Psst... issue #12 has waited 87 days for a reply"
> "@octocat fed me a treat (#42) 🍪"
> "v2.0.0 just shipped! Party time! 🎉"
> "Last fed 420 days ago. I have seen things."

It speaks 7 languages: English (`en`), Tiếng Việt (`vi`), 日本語 (`ja`), 中文 (`zh`), 한국어 (`ko`), Español (`es`) and Français (`fr`).
Chinese, Japanese and Korean wrap correctly in the speech bubble. [More languages welcome!](CONTRIBUTING.md#translate)

<img src="docs/gallery/langs/ja.svg" width="420"> <img src="docs/gallery/langs/ko.svg" width="420">

## Talk to your pet: `/pet`

Comment on any issue or pull request and your pet answers in the thread, in its own language:

| Command | The pet replies with |
| --- | --- |
| `/pet` | its card, how it feels, its vitals and a full checkup |
| `/pet pat` | a happy wiggle 💕 |
| `/pet checkup` | just the checkup |
| `/pet help` | the list of commands |

It needs the `issue_comment` trigger and `issues: write` / `pull-requests: write` (already in the [example workflow](examples/legacypet.yml)).
Comments from bots are ignored, and the `if:` line keeps every other comment from starting a run. Set `commands: false` to switch it off.

## The diary

Click the pet and you land on `DIARY.md`, one line per day of your project's life:

```md
- **2026-10-08** · Day 812 · 🤩 ecstatic · ate 4 commits · got a treat from @octocat (#42) · unlocked 🔥 On Fire · "Best. Maintainer. Ever. 💖"
- **2026-10-07** · Day 811 · 😊 happy · ate 2 commits · "Nom nom, thanks for the commits!"
```

## Checkup

Every run ends with a plain-language checkup in the job summary (also in the CLI and the playground):
why your pet feels the way it does, and what would help.

```text
✔ ❤️ CI is green on the default branch.
! 💬 3 community issues are waiting for a first reply. The oldest is #12 (87 days).
! 🕸️ 19 issues or PRs have been untouched for 30+ days. Triage or close them.
· 🧼 Community profile is at 62%. Add the missing README, license, CONTRIBUTING or code of conduct.
```

## Pet Park

Put **every pet you own in one meadow** on your profile README. The park shows which projects are thriving
and which ones need you.

<img src="docs/gallery/park/park.svg" alt="A Pet Park with six pets: ecstatic, happy, sick, hungry, partying and a zombie" width="840">

In your profile repo (`you/you`), run `npx github:Tanx-1811/legacypet init`, or add `park` to the workflow:

```yaml
      - uses: Tanx-1811/legacypet@v1
        with:
          park: auto # your top 6 repos by stars; or a list: "app, dotfiles, other-owner/lib"
```

and show it with:

```md
[![Pet Park](https://raw.githubusercontent.com/YOU/YOU/legacypet/park.svg)](https://github.com/YOU)
```

Repos that already have their own LegacyPet keep its name, species and trophies in the park.
The default token can read your public repos. To include private ones, pass a personal access token as `github-token`.

## Configuration

| Input | Default | Description |
| --- | --- | --- |
| `species` | `auto` | `auto`, `blob`, `cat`, `duck`, `crab`, `octopus`, `snake`, `cactus`, `ninja`, `mecha`, `dragon`, `bunny`, `bat`, `hero` |
| `scenery` | `auto` | Where the pet lives. `auto` is its species' home, or `meadow`, `garden`, `pond`, `beach`, `reef`, `jungle`, `desert` |
| `name` | | Custom name. Empty means the repo names it. |
| `lang` | `en` | `en`, `vi`, `ja`, `zh`, `ko`, `es` or `fr` |
| `theme` | `auto` | `auto` follows the viewer's light/dark mode. Also `light` or `dark`. |
| `branch` | `legacypet` | Where the pet lives. Rewritten on every run, so use a dedicated branch. |
| `diary` | `true` | Keep `DIARY.md` |
| `park` | | Also draw `park.svg`: `auto` or a list of repos |
| `park-size` | `6` | How many repos `auto` puts in the park (1–8) |
| `ignore-checks` | | Comma-separated check names that shouldn't affect health |
| `keepalive` | `true` | Stop GitHub from pausing the schedule after 60 quiet days (needs `actions: write`) |
| `commands` | `true` | Answer [`/pet` commands](#talk-to-your-pet-pet) in issue and PR comments |
| `dry-run` | `false` | Render without publishing |
| `repository` | current repo | Visit another repo's pet |
| `github-token` | `github.token` | Token used for the API |

**Outputs:** `mood`, `previous-mood`, `mood-changed`, `name`, `level`, `species`, `stage`, `speech`, `aura`, `new-trophies`, `svg-path`.
For example, ping your team only when the pet *just* got sick:

```yaml
      - uses: Tanx-1811/legacypet@v1
        id: pet
      - if: steps.pet.outputs.mood == 'sick' && steps.pet.outputs.mood-changed == 'true'
        run: echo "${{ steps.pet.outputs.name }} is sick! ${{ steps.pet.outputs.speech }}"
```

The branch also holds `pet.json` (the pet's full state and mood history, if you want to build something on top) and a `README.md` with a 14-day mood chart.

## CLI

No install needed. It works on any public repo:

```sh
npx github:Tanx-1811/legacypet init                       # adopt a pet in the current repo
npx github:Tanx-1811/legacypet render vercel/next.js      # draw any repo's pet + checkup
npx github:Tanx-1811/legacypet park sindresorhus          # draw someone's Pet Park
npx github:Tanx-1811/legacypet demo --mood zombie --species cat --lang vi
npx github:Tanx-1811/legacypet demo --species crab --scenery reef
```

In a terminal with true color, it draws the pet right in your shell.

## FAQ

**Will it spam my commit history?** No. The pet lives on its own branch, which is replaced by a single commit on every run.

**Private repos?** Yes. Use `https://github.com/OWNER/REPO/blob/legacypet/pet.svg?raw=true` as the image URL so GitHub serves it to people who have access.

**Why does it need `actions: write`?** GitHub pauses scheduled workflows in repos with no activity for 60 days. That would freeze a neglected pet before it ever turns into a zombie. LegacyPet re-enables its own workflow on each run. Remove the permission and set `keepalive: false` if you'd rather not.

**Does it send my data anywhere?** No. It reads the GitHub API with your workflow's token and writes to your repo. That's all.

**How do I get new features?** `@v1` always points to the latest 1.x release, so updates arrive on their own on the next run.
The first time your pet runs a newer version, the run page shows a notice and the job summary lists **what's new**.
If a feature needs a change to your workflow file (like `/pet`, which needs the `issue_comment` trigger), the summary says so.
Re-run `npx github:Tanx-1811/legacypet init --force` to refresh the workflow, or watch the repo's releases (**Watch → Custom → Releases**).
Breaking changes only ever ship as a new major tag (`@v2`). Every release is listed in [CHANGELOG.md](CHANGELOG.md).

**Is it accessible?** Every SVG has a title and a full text description for screen readers, and all animation stops when the viewer prefers reduced motion.

## Contributing

The best first contribution is a **new species**: a 16×16 grid of letters, a palette and a trait.
It takes about ten minutes, and `npm run gallery` shows it in every mood right away. See [CONTRIBUTING.md](CONTRIBUTING.md).

The playground runs the exact same code in the browser: `npm run playground` and open http://localhost:4173.

Ideas on the roadmap:

- 🌍 Even more languages (each one is a single file)
- 🐉 Rare evolutions (a duck that becomes a phoenix after 1,000 days without a red build?)
- 🤝 **Visits**: pets of repos that depend on each other say hi

## License

[MIT](LICENSE). Adopt freely.
