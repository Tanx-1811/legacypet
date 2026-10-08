import { checkup } from '../engine/checkup.js';
import { MOOD_EMOJI } from '../engine/mood.js';
import { strings } from '../i18n/index.js';
import { createRng } from '../util/rng.js';

// `/pet` in an issue or PR comment: the pet answers in the thread.
export const COMMANDS = ['status', 'pat', 'checkup', 'help'];
const CHECK_ICON = { good: '✅', warn: '⚠️', bad: '❌', tip: '💡' };
const REACTION = { status: 'eyes', pat: 'heart', checkup: '+1', help: 'eyes' };

// Returns the command name, or null when the comment isn't for the pet.
export function parseCommand(body) {
  const match = /^\s*\/pet(?:\s+(\w+))?\s*$/im.exec(String(body ?? ''));
  if (!match) return null;
  const name = (match[1] ?? 'status').toLowerCase();
  return COMMANDS.includes(name) ? name : 'help';
}

// The comment event that should be answered, or null. Bots never talk to the pet,
// which also keeps the pet from answering its own replies.
export function commandFromEvent(eventName, event) {
  if (eventName !== 'issue_comment' || event?.action !== 'created') return null;
  const comment = event.comment;
  if (!comment || comment.user?.type === 'Bot' || /\[bot\]$/.test(comment.user?.login ?? '')) return null;
  const command = parseCommand(comment.body);
  if (!command) return null;
  return { command, issue: event.issue.number, commentId: comment.id, user: comment.user?.login };
}

export function commandReply(pet, snapshot, { command, user, cardUrl }) {
  const tr = strings(pet.lang);
  const c = tr.command;
  const header = `### ${MOOD_EMOJI[pet.mood]} ${pet.displayName}`;
  const kind = `**${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}** · ${tr.moods[pet.mood]}${pet.shiny ? ' ✨' : ''}${pet.aura ? ' 💥' : ''}`;
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
  if (command === 'help') return [header, '', c.help, '', ...COMMANDS.map((name) => `- \`/pet${name === 'status' ? '' : ` ${name}`}\`: ${c.usage[name]}`)].join('\n');
  if (command === 'checkup') return [header, '', `#### 🩺 ${c.checkup}`, '', ...care, '', ...help].join('\n');
  return [
    header, '', kind, '', `> ${pet.speech}`, '',
    ...(cardUrl ? [`<img src="${cardUrl}" alt="${pet.displayName}" width="420">`, ''] : []),
    ...table, '', `#### 🩺 ${c.checkup}`, '', ...care, '', ...help,
  ].join('\n');
}

export async function answerCommand(client, { owner, repo, request, pet, snapshot, cardUrl }) {
  const base = `/repos/${owner}/${repo}`;
  await client.post(`${base}/issues/comments/${request.commentId}/reactions`, { content: REACTION[request.command] }).catch(() => {});
  const body = commandReply(pet, snapshot, { command: request.command, user: request.user, cardUrl });
  return client.post(`${base}/issues/${request.issue}/comments`, { body });
}
