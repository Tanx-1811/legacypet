# Contributing to LegacyPet

Thanks for wanting to help raise more pets! 🐾 The project has **zero dependencies**:
all you need is Node.js 20 or newer.

```sh
git clone https://github.com/Tanx-1811/legacypet && cd legacypet
node --test          # run the tests
npm run gallery      # draw everything into docs/gallery/index.html
node src/cli.js demo --species cat --mood party   # try one pet
```

## Add a species

1. Copy `src/sprites/species/blob.js` to `src/sprites/species/<your-species>.js`.
2. Draw a **16×16** grid. `.` is transparent and every other letter is a color from `palette`.
   By convention `o` is the outline, `b` the body, `l` a highlight and `s` a shade.
   Keep the face area (`b` pixels) free for eyes and mouth.
3. Set the anchors:
   - `eyes`: the top-left pixel of each 2×2 eye, left eye first. Keep them symmetric.
   - `mouth`: the top-left pixel of a 4-wide mouth. Add `mouthStyle: 'beak'` plus `a`/`A` colors for a beak.
   - `cheeks`: the left pixel of each 2×1 blush.
   - `hat`: `[center column, top row of the head]`. Hats sit on that row.
   - `home`: where it lives: `meadow`, `garden`, `pond`, `beach`, `reef`, `jungle` or `desert` (see `src/render/scenery.js`).
   - `shinyKeep` (optional): palette letters that keep their color on a shiny pet, like a cape or a gem.
4. Give it a `trait`: one rule it bends. The options in `modifiers` are
   `hungerRate`, `ciPenalty`, `issuePenalty`, `releaseJoy`, `teamEnergy`, `streakEnergy`, `ciEnergyFloor`,
   `inboxJoy`, `healthFloor`, `xpRate` and `starJoy` (see `src/engine/vitals.js`).
   Optional: catchphrases in `lines.species.<id>` of each language file, mixed in on good days.
   A brand-new kind of trait is welcome too, as long as you explain it in the PR.
5. Register it in `src/sprites/index.js`, and add its name and trait to every file in `src/i18n/`.
6. Run `npm run gallery`, open `docs/gallery/index.html` and look at it in every mood, in light and dark.
   `node --test` checks that the grid, anchors and translations line up.

Tips: draw in a monospace editor, keep it to about 6 colors, and make sure the silhouette reads at 80px wide.

## Translate

Copy `src/i18n/en.js` to `src/i18n/<code>.js`, translate it, and register it in `src/i18n/index.js`:
add it to `TRANSLATIONS` and give it a native name in `LANG_NAMES` (the CLI help and the playground list it from there).
Then add it to the `lang` description in `action.yml` and the language list in both READMEs.
Lines can be plain strings or functions of `v` (see `speechVars` in `src/engine/speech.js` for every variable).
Keep the speech bubble short: two lines of about 36 characters (CJK characters count double).
Keys you leave out fall back to English, and `node --test` lists any that are missing.

## Add dialogue, a holiday or a trophy

- **Dialogue** lives in `lines` in each language file. Funnier, kinder and more specific beats generic.
- **Holidays** live in `src/engine/calendar.js`. Add the hat or scene effect in `src/engine/mood.js` and `src/render/scene.js`.
- **Trophies** live in `src/engine/achievements.js`. They should reward a good maintenance habit, never grinding.

## Ship a release (maintainers)

Users pin `Tanx-1811/legacypet@v1`, so a release reaches everyone on their next run. To tell them what changed:

1. Add an entry at the top of `CHANGELOG` in `src/whatsnew.js`, and bump `VERSION` there and in `package.json` (a test checks they match).
   If a feature needs users to edit their workflow, give the entry a `workflow: { why, test }` so the summary tells them how.
2. Update `examples/legacypet.yml` and `workflowYaml` in `src/setup.js` if the workflow changed.
3. Tag and move the major tag:

   ```sh
   git tag v1.1.0 && git tag -f v1 && git push origin v1.1.0 && git push -f origin v1
   ```

4. Publish a GitHub Release for `v1.1.0` with the same notes, so people watching releases get an email.

Breaking changes (renamed inputs, new required permissions) go to a new major tag: `v2`.

## Ground rules

- No runtime dependencies. The action must stay a single `node` call.
- Rendering is deterministic: the same snapshot and date always produce the same SVG. Use `createRng`, never `Math.random`.
- The pet judges what visitors care about, not vanity metrics. Being kind to maintainers is a feature.
- Animations must be decorative. The card has to make sense as a still image and with reduced motion.
