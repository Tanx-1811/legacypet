// What changed in each release. The action remembers the last version it ran in pet.json
// and tells the owner about anything newer in the job summary, so people pinned to the
// floating `@v1` tag hear about new features (and the rare workflow change they need).
// Keep VERSION in sync with package.json (a test checks it).
export const VERSION = '1.2.0';

export const CHANGELOG = [
  {
    version: '1.2.0',
    items: [
      '🏖️ Vacation mode: set `vacation: until 2027-01-05` (or comment `/pet vacation 14`). Hunger pauses, the pet goes to the beach in sunglasses, and the days away never count',
      '🚨 Care alerts (opt-in, `alerts: true`): one issue when the pet stays sick or turns zombie, kept up to date and closed automatically when it recovers',
      '📈 `pet-stats.svg`: a 30-day chart of fullness, health, joy and energy with the mood of each day',
      '🏆 New commands: `/pet trophies`, plus `/pet vacation [days]` and `/pet back` for maintainers',
      '🌄 Livelier scenes: rainbows, shooting stars, northern lights, bunting, fog, bats, string lights and a blooming mai branch at Tết',
      '🕺 Signature moves: on good days every species shows off its own move (the ninja leaves shadow clones, the mecha fires its jets, the bat does a backflip…)',
      '📤 New outputs: `on-vacation`, `alert-issue`',
    ],
  },
  {
    version: '1.1.0',
    items: [
      '🦸 6 new species, the hero squad: ninja, mecha, dragon, bunny, bat and hero, each with a brand-new trait',
      '🏞️ Every species has a home (meadow, garden, pond, beach, reef, jungle, desert). Move it with `scenery`',
      '🌍 5 new languages: 日本語 (ja), 中文 (zh), 한국어 (ko), Español (es), Français (fr)',
      '💥 Super form: 7 ecstatic days in a row unlock a golden aura and a trophy',
      '🏆 New trophies: Super Form, First Responder and Anniversary',
      '💬 Talk to your pet: comment `/pet`, `/pet pat` or `/pet checkup` on any issue or PR',
      '🛡️ `pet-shields.json`: a shields.io endpoint badge, plus a 14-day mood chart on the pet branch',
      '📤 New outputs: `previous-mood`, `mood-changed`, `aura`, `new-trophies`',
    ],
    // Features that only work after the user changes their workflow file.
    workflow: {
      why: 'The `/pet` command needs the `issue_comment` trigger and `issues: write` + `pull-requests: write` permissions.',
      test: (yaml) => /issue_comment/.test(yaml),
    },
  },
];

function compare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// Releases newer than the one this pet last ran with. A brand-new pet has nothing to catch
// up on; a pet from before versions were recorded is treated as 1.0.0.
export function whatsNew(prevState, current = VERSION) {
  if (!prevState) return [];
  const seen = prevState.version ?? '1.0.0';
  return CHANGELOG.filter((entry) => compare(entry.version, seen) > 0 && compare(entry.version, current) <= 0);
}
