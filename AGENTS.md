# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, …) working on LegacyPet. Humans: start with
[CONTRIBUTING.md](CONTRIBUTING.md). It holds the recipes (add a species, translate, dialogue, holidays,
trophies, ship a release) and the ground rules. This file does not repeat them: read the matching section there first.

LegacyPet is a pixel pet that lives in a README. One rendering engine, four ways to ship it: a GitHub Action
(`action.yml` → `src/action.js`), a CLI (`src/cli.js`, the `legacypet` bin), the app (`site/` + `src/app/` +
`src/local/`), and an Electron desktop wrapper (`desktop/`). Node 20+, ES modules, no build step.

## Map

| Path | What lives there |
| --- | --- |
| `src/engine/` | Vitals, mood, growth, quests, trophies, speech: the rules |
| `src/render/`, `src/sprites/` | SVG rendering; species are 16×16 grids registered in `src/sprites/index.js` |
| `src/i18n/` | One file per language; `en.js` is the base, `index.js` registers them |
| `src/github/` | GitHub API: collect a snapshot, publish, `/pet` commands, adopt, park |
| `src/local/`, `src/app/` | The app: finds git repos on this computer, local server, data in `LEGACYPET_HOME` |
| `src/setup.js` | `workflowYaml()` and the README snippet used by `init`, adopt and the playground |
| `src/whatsnew.js` | `VERSION` and the in-product `CHANGELOG` shown in job summaries |
| `site/` | Playground and app UI, published to GitHub Pages on every push to `main` |
| `desktop/` | Electron app; the only place with dependencies (its own `package.json`) |
| `docs/gallery/` | **Generated** by `npm run gallery` (633 files). Never edit by hand |
| `examples/legacypet.yml` | Hand-annotated copy of `workflowYaml()`; a test keeps them in step |

## Commands

```sh
node --test                                      # all tests (node:test, ~12 s)
npm run gallery                                  # re-render docs/gallery (deterministic)
node src/cli.js gallery --out /tmp/gallery && diff -rq docs/gallery /tmp/gallery   # what CI checks
node src/cli.js demo --species cat --mood party  # one pet, written to legacypet-out/ (gitignored)
LEGACYPET_HOME="$(mktemp -d)" node src/cli.js app --no-open   # the app, with throwaway data
npm run playground                               # serve site/ like GitHub Pages (port 4173)
```

`desktop/` needs `npm install` inside `desktop/` (Electron). Ask before installing anything.

## Definition of done

1. `node --test` passes.
2. If the change can affect rendering (sprites, render, engine, i18n, `src/cli.js` gallery code), run
   `npm run gallery` and check `git status -- docs/gallery`. No diff is expected unless the change is meant to
   change pictures; if it is, commit the regenerated files with it. CI re-renders and fails on any drift.
3. User-facing changes get a line in `CHANGELOG.md` **and** in `CHANGELOG` in `src/whatsnew.js`.
4. Text shown to users exists in every file in `src/i18n/`; docs changes land in both `README.md` and `README.vi.md`.

## Rules for agents

- **Isolate local data.** Set `LEGACYPET_HOME` to a temp dir before running the app or anything in `src/local/`.
  Without it, the code reads and writes the real `~/.legacypet` (`src/local/store.js`).
- **Don't touch real repos.** `legacypet init` edits the current repo's README and workflow; `legacypet adopt` and the
  app's Adopt button commit and push to GitHub. `render` and `park` call the GitHub API. Use `demo`, `gallery` and
  the tests instead, unless the user asks.
- **`docs/gallery/` is output.** Regenerate it with `npm run gallery`; never hand-edit or partially update it.
- **Zero runtime dependencies.** No `dependencies` in the root `package.json` (a test checks it); the action is a
  single `node` call. Dependencies belong only in `desktop/`.
- **Deterministic rendering.** Same snapshot + date → same SVG. Use `createRng` from `src/util/rng.js`, never
  `Math.random`, in anything that ends up in an SVG. No `Date.now()` in render paths: take `now` as input.
- **Keep the pairs in sync** (tests check most of them):
  `README.md` ↔ `README.vi.md`; `CHANGELOG.md` ↔ `CHANGELOG`/`VERSION` in `src/whatsnew.js` ↔ `package.json` ↔
  `desktop/package.json`; `examples/legacypet.yml` ↔ `workflowYaml()`; languages, species and homes ↔ `action.yml`.
- **Releases are the maintainer's.** Never run `git push -f`, move the `v1` tag, `gh release …` or `npm publish`.
  `package.json` is not private and has a `bin`, and every user runs `@v1`, so these reach everyone at once.
  Prepare the release commit (version bumps, notes) if asked and stop there.
- Don't commit or push unless asked. A push to `main` redeploys GitHub Pages.

## Agent harness

`.claude/settings.json` runs `node --test` when Claude finishes a turn after editing; publish/release/tag
commands (`npm publish`, `gh release`, `git tag`, pushing tags) require confirmation, and force-push and
`git reset --hard` are blocked. `CLAUDE.md` only imports this file, so edit this one.
