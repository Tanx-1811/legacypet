import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPet } from '../src/engine/pet.js';
import { nextState } from '../src/engine/memory.js';
import { activeVacation, lastDay, MAX_VACATION_DAYS, parseVacation, resolveVacations, vacationDays } from '../src/engine/vacation.js';
import { parseAlerts, syncAlert } from '../src/github/alerts.js';
import { commandDays, commandFromEvent, commandReply, parseCommand } from '../src/github/command.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { renderStats } from '../src/render/stats.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const pet = (mood, options = {}, prevState = null) =>
  buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, prevState, options: { holiday: null, species: 'cat', ...options } });

test('vacation specs: ranges, "until" and bad input', () => {
  assert.deepEqual(parseVacation('2026-12-20..2027-01-05'), { from: '2026-12-20', until: '2027-01-05' });
  assert.deepEqual(parseVacation('until 2027-01-05'), { from: null, until: '2027-01-05' });
  assert.deepEqual(parseVacation('2027-01-05'), { from: null, until: '2027-01-05' });
  assert.equal(parseVacation(''), null);
  assert.throws(() => parseVacation('next week'), /vacation/);
  assert.throws(() => parseVacation('2027-01-05..2026-12-20'), /vacation/);
});

test('vacation days never count toward hunger, and vacations are capped', () => {
  const trip = [{ from: '2026-10-01', until: '2026-10-05' }];
  assert.equal(vacationDays(trip, '2026-09-25T00:00:00Z', NOW), 5);
  assert.equal(vacationDays(trip, '2026-10-07T00:00:00Z', NOW), 0); // committed after the trip
  assert.equal(lastDay({ from: '2026-01-01', until: '2027-01-01' }), '2026-03-01'); // 60 days
  assert.equal(MAX_VACATION_DAYS, 60);

  const away = pet('hungry', { vacation: '2026-09-01..2026-10-30' });
  const home = pet('hungry');
  assert.ok(away.vacation);
  assert.ok(away.facts.hungerDays < home.facts.daysSinceCommit);
  assert.ok(away.vitals.fullness > home.vitals.fullness);
  assert.equal(away.home, 'beach');
  assert.equal(away.accessories.face, 'sunglasses');
  assert.match(away.speech, /2026-10-30|Out of office/);
  assert.match(renderCard(away), /#1b1b2f/); // the shades
});

test('/pet vacation starts a trip and /pet back ends it early', () => {
  const today = '2026-10-08';
  const started = resolveVacations({ command: { name: 'vacation', days: 14 }, today });
  assert.deepEqual(activeVacation(started, today), { from: today, until: '2026-10-21', source: 'command' });
  const later = resolveVacations({ previous: [{ from: '2026-10-01', until: '2026-10-21', source: 'command' }], command: { name: 'back' }, today });
  assert.equal(activeVacation(later, today), null);
  assert.equal(lastDay(later[0]), '2026-10-07'); // the days away still count as vacation
  // Coming back the same day the trip started means it never happened.
  assert.deepEqual(resolveVacations({ previous: started, command: { name: 'back' }, today }), []);
  // The input doesn't restart a vacation the owner already came back from.
  const input = resolveVacations({ previous: [{ from: '2026-10-01', until: '2026-10-21', source: 'input', ended: today }], spec: parseVacation('until 2026-10-21'), today });
  assert.equal(activeVacation(input, today), null);

  const state = nextState(pet('happy', { vacationCommand: { name: 'vacation', days: 3 } }));
  assert.equal(state.vacations.length, 1);
  assert.equal(activeVacation(state.vacations, today).until, '2026-10-10');
});

test('vacation and trophy commands, and who may use them', () => {
  assert.equal(parseCommand('/pet vacation 14'), 'vacation');
  assert.equal(commandDays('/pet vacation 14'), 14);
  assert.equal(commandDays('/pet back'), null);
  assert.equal(parseCommand('/pet trophies'), 'trophies');
  const event = (association) => ({
    action: 'created', issue: { number: 3 },
    comment: { id: 5, body: '/pet vacation 10', user: { login: 'me', type: 'User' }, author_association: association },
  });
  assert.equal(commandFromEvent('issue_comment', event('OWNER')).maintainer, true);
  assert.equal(commandFromEvent('issue_comment', event('NONE')).maintainer, false);
  assert.equal(commandFromEvent('issue_comment', event('OWNER')).days, 10);

  const p = pet('happy', { vacationCommand: { name: 'vacation', days: 10 } });
  const snapshot = mockSnapshot({ mood: 'happy', now: NOW });
  assert.match(commandReply(p, snapshot, { command: 'vacation', maintainer: true }), /2026-10-17/);
  assert.match(commandReply(p, snapshot, { command: 'vacation', maintainer: false }), /Only maintainers/);
  assert.match(commandReply(p, snapshot, { command: 'back', wasOnVacation: false }), /not on vacation/);
  assert.match(commandReply(p, snapshot, { command: 'trophies' }), /Trophy shelf: \d+ of \d+/);
});

// A tiny stand-in for the GitHub API that remembers every call.
function fakeClient(issues = {}, { listed = [] } = {}) {
  const calls = [];
  let next = 100;
  return {
    calls,
    issues,
    get: async (path) => {
      calls.push(['GET', path]);
      if (path.endsWith('/issues')) return listed;
      const issue = issues[Number(path.split('/').pop())];
      if (!issue) throw Object.assign(new Error('Not Found'), { status: 404 });
      return issue;
    },
    post: async (path, body) => {
      calls.push(['POST', path, body]);
      if (path.endsWith('/issues')) {
        const number = next++;
        issues[number] = { number, state: 'open', ...body };
        return issues[number];
      }
      return {};
    },
    patch: async (path, body) => {
      calls.push(['PATCH', path, body]);
      Object.assign(issues[Number(path.split('/').pop())], body);
      return {};
    },
  };
}

test('care alerts: wait a run, open one issue, keep it fresh, close it on recovery', async () => {
  assert.equal(parseAlerts('false'), null);
  assert.deepEqual([...parseAlerts('true')], ['sick', 'zombie']);
  assert.deepEqual([...parseAlerts('sick, hungry')], ['sick', 'hungry']);
  assert.throws(() => parseAlerts('grumpy'), /Unknown alert mood/);

  const moods = parseAlerts('true');
  const sick = pet('sick');
  const snapshot = mockSnapshot({ mood: 'sick', now: NOW });
  const base = { owner: 'o', repo: 'r', snapshot, moods };
  const client = fakeClient();

  // First sick run: one flaky build isn't an emergency.
  assert.equal(await syncAlert(client, { ...base, pet: sick, prevMood: 'happy' }), null);
  assert.equal(client.calls.length, 0);

  // Second sick run in a row: open the issue.
  const opened = await syncAlert(client, { ...base, pet: sick, prevMood: 'sick' });
  assert.equal(opened.issue, 100);
  assert.match(client.issues[100].title, /sick/);
  assert.deepEqual(client.issues[100].labels, ['legacypet']);

  // Still sick: same issue, nothing new.
  const again = await syncAlert(client, { ...base, pet: sick, prev: opened, prevMood: 'sick' });
  assert.equal(again.issue, 100);
  assert.equal(client.calls.filter(([m, p]) => m === 'POST' && p.endsWith('/issues')).length, 1);

  // Better: a thank-you comment, then closed.
  const happy = pet('happy');
  assert.equal(await syncAlert(client, { ...base, pet: happy, prev: again, prevMood: 'sick' }), null);
  assert.equal(client.issues[100].state, 'closed');
  assert.ok(client.calls.some(([m, p, b]) => m === 'POST' && p.endsWith('/100/comments') && /feels better/.test(b.body)));
});

test('care alerts: closing by hand mutes, vacations stay quiet, lost state is adopted', async () => {
  const moods = parseAlerts('sick');
  const snapshot = mockSnapshot({ mood: 'sick', now: NOW });
  const base = { owner: 'o', repo: 'r', snapshot, moods };

  const muted = fakeClient({ 7: { number: 7, state: 'closed', title: 'x', body: 'y' } });
  const result = await syncAlert(muted, { ...base, pet: pet('sick'), prev: { issue: 7, mood: 'sick', since: '2026-10-01' }, prevMood: 'sick' });
  assert.equal(result.muted, true);
  assert.equal(muted.calls.filter(([m]) => m !== 'GET').length, 0);

  const beach = fakeClient();
  assert.equal(await syncAlert(beach, { ...base, pet: pet('sick', { vacation: 'until 2026-10-20' }), prevMood: 'sick' }), null);
  assert.equal(beach.calls.length, 0);

  const lost = fakeClient({ 42: { number: 42, state: 'open' } }, { listed: [{ number: 42 }] });
  const adopted = await syncAlert(lost, { ...base, pet: pet('sick'), prevMood: 'sick' });
  assert.equal(adopted.issue, 42);
  assert.equal(lost.calls.filter(([m, p]) => m === 'POST' && p.endsWith('/issues')).length, 0);
});

test('the stats chart draws 30 days of vitals and handles gaps and empty history', () => {
  const p = pet('happy');
  assert.deepEqual(nextState(p).history[0].vitals, [p.vitals.fullness, p.vitals.health, p.vitals.joy, p.vitals.energy]);

  const history = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(NOW.getTime() - i * 86_400_000).toISOString().slice(0, 10),
    mood: i % 2 ? 'happy' : 'sick',
    vitals: [80 - i, i % 5 ? 100 : 30, 70, null],
  })).filter((_, i) => i !== 10);
  const svg = renderStats(p, history);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  assert.equal((svg.match(/<polyline/g) ?? []).length, 6); // 3 vitals × 2 runs around the missing day
  assert.equal((svg.match(/class="lp-emoji"/g) ?? []).length, 29); // 30 days minus the gap
  assert.match(renderStats(p, []), /Not enough history yet/);
  assert.match(renderStats({ ...p, lang: 'vi' }, []), /Chưa đủ dữ liệu/);
});
