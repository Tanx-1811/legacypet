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
4. Give it a `trait`: one rule it bends. The options in `modifiers` are
   `hungerRate`, `ciPenalty`, `issuePenalty`, `releaseJoy` and `teamEnergy` (see `src/engine/vitals.js`).
   A brand-new kind of trait is welcome too, as long as you explain it in the PR.
5. Register it in `src/sprites/index.js`, and add its name and trait to every file in `src/i18n/`.
6. Run `npm run gallery`, open `docs/gallery/index.html` and look at it in every mood, in light and dark.
   `node --test` checks that the grid, anchors and translations line up.

Tips: draw in a monospace editor, keep it to about 6 colors, and make sure the silhouette reads at 80px wide.

## Translate

Copy `src/i18n/en.js` to `src/i18n/<code>.js`, translate it, and register it in `src/i18n/index.js`.
Lines can be plain strings or functions of `v` (see `speechVars` in `src/engine/speech.js` for every variable).
Keep the speech bubble short: two lines of about 36 characters.

## Add dialogue, a holiday or a trophy

- **Dialogue** lives in `lines` in each language file. Funnier, kinder and more specific beats generic.
- **Holidays** live in `src/engine/calendar.js`. Add the hat or scene effect in `src/engine/mood.js` and `src/render/scene.js`.
- **Trophies** live in `src/engine/achievements.js`. They should reward a good maintenance habit, never grinding.

## Ground rules

- No runtime dependencies. The action must stay a single `node` call.
- Rendering is deterministic: the same snapshot and date always produce the same SVG. Use `createRng`, never `Math.random`.
- The pet judges what visitors care about, not vanity metrics. Being kind to maintainers is a feature.
- Animations must be decorative. The card has to make sense as a still image and with reduced motion.
