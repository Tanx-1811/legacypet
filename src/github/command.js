import { ACHIEVEMENTS } from '../engine/achievements.js';
import { checkup } from '../engine/checkup.js';
import { MOOD_EMOJI } from '../engine/mood.js';
import { RANKS } from '../engine/rank.js';
import { strings } from '../i18n/index.js';
import { createRng } from '../util/rng.js';

// `/pet` in an issue or PR comment: the pet answers in the thread.
export const COMMANDS = ['status', 'pat', 'checkup', 'level', 'trophies', 'vacation', 'back', 'help'];
// Commands that change the pet's state, so only people who maintain the repo may use them.
export const MAINTAINER_COMMANDS = new Set(['vacation', 'back']);
const MAINTAINERS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const CHECK_ICON = { good: '✅', warn: '⚠️', bad: '❌', tip: '💡' };
const REACTION = { status: 'eyes', pat: 'heart', checkup: '+1', level: 'rocket', trophies: 'hooray', vacation: 'rocket', back: 'heart', help: 'eyes' };
const COMMAND = /^\s*\/pet(?:\s+(\w+)(?:\s+(\d{1,3}))?)?\s*$/im;

// Returns the command name, or null when the comment isn't for the pet.
export function parseCommand(body) {
  const match = COMMAND.exec(String(body ?? ''));
  if (!match) return null;
  const name = (match[1] ?? 'status').toLowerCase();
  return COMMANDS.includes(name) ? name : 'help';
}

// The number after a command, as in `/pet vacation 14`.
export function commandDays(body) {
  const days = COMMAND.exec(String(body ?? ''))?.[2];
  return days ? Number(days) : null;
}

// The comment event that should be answered, or null. Bots never talk to the pet,
// which also keeps the pet from answering its own replies.
export function commandFromEvent(eventName, event) {
  if (eventName !== 'issue_comment' || event?.action !== 'created') return null;
  const comment = event.comment;
  if (!comment || comment.user?.type === 'Bot' || /\[bot\]$/.test(comment.user?.login ?? '')) return null;
  const command = parseCommand(comment.body);
  if (!command) return null;
  const request = {
    command, issue: event.issue.number, commentId: comment.id, user: comment.user?.login,
    maintainer: MAINTAINERS.has(comment.author_association),
  };
  const days = commandDays(comment.body);
  if (days != null) request.days = days;
  return request;
}

export function commandReply(pet, snapshot, { command, user, cardUrl, maintainer = true, wasOnVacation = false }) {
  const tr = strings(pet.lang);
  const c = tr.command;
  const header = `### ${MOOD_EMOJI[pet.mood]} ${pet.displayName}`;
  const kind = `**${pet.rank.emoji} ${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}** · ${tr.moods[pet.mood]}${pet.shiny ? ' ✨' : ''}${pet.aura ? ' 💥' : ''}`;
  const help = [
    `<sub>${c.commands}: ${COMMANDS.map((name) => `\`/pet${name === 'status' ? '' : ` ${name}`}\` ${c.usage[name]}`).join(' · ')}</sub>`,
  ];
  const care = checkup(pet, snapshot).map((item) => `- ${CHECK_ICON[item.level]} ${item.icon} ${item.text}`);
  const vitals = ['fullness', 'health', 'joy', 'energy', 'hygiene'].filter((k) => pet.vitals[k] != null);
  const table = [
    `| ${vitals.map((k) => tr.stats[k]).join(' | ')} |`,
    `| ${vitals.map(() => '---').join(' | ')} |`,
    `| ${vitals.map((k) => pet.vitals[k]).join(' | ')} |`,
  ];

  if (command === 'pat') {
    const rng = createRng(`${pet.repo.fullName}|${pet.date}|pat|${user ?? ''}`);
    const line = rng.pick(c.pat);
    const text = typeof line === 'function' ? line({ name: pet.name, user }) : line;
    return [header, '', `> ${text}`, '', ...help].join('\n');
  }
  if (MAINTAINER_COMMANDS.has(command) && !maintainer) return [header, '', `> ${c.maintainersOnly(command)}`, '', ...help].join('\n');
  if (command === 'vacation' && pet.vacation) {
    const days = Math.round((Date.parse(pet.vacation.until) - Date.parse(pet.vacation.from)) / 86_400_000) + 1;
    return [header, '', `> ${c.vacation(pet.vacation.until, days)}`, '', ...help].join('\n');
  }
  if (command === 'back') return [header, '', `> ${wasOnVacation ? c.back : c.notOnVacation}`, '', ...help].join('\n');
  if (command === 'level') {
    const { nextLevel, nextRank } = pet.progress;
    const filled = Math.round(pet.xp * 10);
    const ladder = RANKS.map((r) => (r.id === pet.rank.id ? `**${r.emoji} ${tr.ranks[r.id]}**` : `${r.emoji} ${tr.ranks[r.id]}`) + ` (${r.min}+)`);
    return [
      header, '', `#### ${pet.rank.emoji} ${c.level.title(pet.level, tr.ranks[pet.rank.id])}`, '',
      `\`${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}\` ${Math.round(pet.xp * 100)}%`, '',
      ...(nextLevel ? [`- ⬆️ ${c.level.nextLevel(nextLevel.commits, nextLevel.level)}`] : [`- ${c.level.maxed}`]),
      ...(nextRank ? [`- ${nextRank.emoji} ${c.level.nextRank(nextRank.commits, tr.ranks[nextRank.id])}`] : []),
      '', `<sub>${c.level.ladder}: ${ladder.join(' → ')}</sub>`, '', ...help,
    ].join('\n');
  }
  if (command === 'trophies') {
    const got = new Set(pet.achievements.map((a) => a.id));
    const shelf = pet.achievements.map((a) => `- ${a.emoji} **${tr.achievements[a.id]}** · ${a.unlockedAt}${a.isNew ? ' 🆕' : ''}`);
    const locked = ACHIEVEMENTS.filter((a) => !got.has(a.id)).map((a) => `${a.emoji} ${tr.achievements[a.id]}`);
    return [
      header, '', `#### 🏆 ${c.trophies(got.size, ACHIEVEMENTS.length)}`, '', ...(shelf.length ? shelf : [`_${tr.noAchievements}_`]), '',
      ...(locked.length ? [`<sub>🔒 ${c.locked}: ${locked.join(' · ')}</sub>`, ''] : []), ...help,
    ].join('\n');
  }
  if (command === 'help') return [header, '', c.help, '', ...COMMANDS.map((name) => `- \`/pet${name === 'status' ? '' : ` ${name}`}\`: ${c.usage[name]}`)].join('\n');
  if (command === 'checkup') return [header, '', `#### 🩺 ${c.checkup}`, '', ...care, '', ...help].join('\n');
  return [
    header, '', kind, '', `> ${pet.speech}`, '',
    ...(cardUrl ? [`<img src="${cardUrl}" alt="${pet.displayName}" width="420">`, ''] : []),
    ...table, '', `#### 🩺 ${c.checkup}`, '', ...care, '', ...help,
  ].join('\n');
}

export async function answerCommand(client, { owner, repo, request, pet, snapshot, cardUrl, wasOnVacation }) {
  const base = `/repos/${owner}/${repo}`;
  await client.post(`${base}/issues/comments/${request.commentId}/reactions`, { content: REACTION[request.command] }).catch(() => {});
  const body = commandReply(pet, snapshot, {
    command: request.command, user: request.user, cardUrl, maintainer: request.maintainer, wasOnVacation,
  });
  return client.post(`${base}/issues/${request.issue}/comments`, { body });
}
