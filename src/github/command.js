import { ACHIEVEMENTS } from '../engine/achievements.js';
import { careBonus, topFriends } from '../engine/care.js';
import { checkup } from '../engine/checkup.js';
import { isUnlocked, ITEMS, itemById, parseWear, SLOTS } from '../engine/items.js';
import { MOOD_EMOJI } from '../engine/mood.js';
import { RANKS } from '../engine/rank.js';
import { strings } from '../i18n/index.js';
import { createRng } from '../util/rng.js';

// `/pet` in an issue or PR comment: the pet answers in the thread.
export const COMMANDS = [
  'status', 'pat', 'feed', 'play', 'checkup', 'level', 'quests', 'trophies', 'wardrobe', 'wear', 'vacation', 'back', 'help',
];
// Other words people naturally try.
const ALIASES = { pet: 'pat', hug: 'pat', snack: 'feed', treat: 'feed', quest: 'quests', items: 'wardrobe', dress: 'wear' };
// Commands that change the pet's state, so only people who maintain the repo may use them.
export const MAINTAINER_COMMANDS = new Set(['vacation', 'back', 'wear']);
const MAINTAINERS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const CHECK_ICON = { good: '✅', warn: '⚠️', bad: '❌', tip: '💡' };
const REACTION = {
  status: 'eyes', pat: 'heart', feed: 'heart', play: 'laugh', checkup: '+1', level: 'rocket', quests: 'rocket',
  trophies: 'hooray', wardrobe: 'eyes', wear: 'hooray', vacation: 'rocket', back: 'heart', help: 'eyes',
};
const COMMAND = /^\s*\/pet(?:\s+(\w+)(?:\s+([\w-]+(?:[\s,]+[\w-]+){0,5}))?)?\s*$/im;

// Returns the command name, or null when the comment isn't for the pet.
export function parseCommand(body) {
  const match = COMMAND.exec(String(body ?? ''));
  if (!match) return null;
  const word = (match[1] ?? 'status').toLowerCase();
  const name = ALIASES[word] ?? word;
  return COMMANDS.includes(name) ? name : 'help';
}

// The words after a command, as in `/pet wear cap bird`.
export const commandArg = (body) => COMMAND.exec(String(body ?? ''))?.[2]?.toLowerCase() ?? null;

// The number after a command, as in `/pet vacation 14`.
export function commandDays(body) {
  const days = commandArg(body);
  return days && /^\d{1,3}$/.test(days) ? Number(days) : null;
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
  const arg = commandArg(comment.body);
  if (arg != null && days == null) request.arg = arg;
  return request;
}

const itemName = (tr, id) => `${itemById(id)?.emoji ?? ''} ${tr.items[id] ?? id}`.trim();

export function unlockHint(tr, item) {
  const u = item.unlock;
  if (u.achievement) return tr.unlock.achievement(tr.achievements[u.achievement]);
  if (u.stars) return tr.unlock.stars(u.stars);
  if (u.friends) return tr.unlock.friends(u.friends);
  return tr.unlock.free;
}

// `/pet feed`, `/pet play` and `/pet pat`: what the pet says depends on what happened (see engine/care.js).
function careReply(pet, tr, { command, user }) {
  const c = tr.command;
  if (pet.careOutcome === 'cant') return c.cant[pet.mood] ?? c.cant.egg;
  if (pet.careOutcome === 'again') return c.again[command];
  const rng = createRng(`${pet.repo.fullName}|${pet.date}|${command}|${user ?? ''}`);
  const line = rng.pick(c[command]);
  return typeof line === 'function' ? line({ name: pet.name, user }) : line;
}

export function questLines(pet, tr) {
  const q = pet.quests;
  if (!q?.list.length) return [`_${tr.command.quests.none}_`];
  return q.list.map((item) => {
    const bar = item.goal > 1 ? ` \`${'▰'.repeat(item.progress)}${'▱'.repeat(item.goal - item.progress)}\` ${item.progress}/${item.goal}` : '';
    return `- ${item.done ? '✅' : '⬜'} ${item.emoji} ${tr.quests[item.id](item.goal)}${bar}${item.isNew ? ' 🆕' : ''}`;
  });
}

export function commandReply(pet, snapshot, { command, user, arg, cardUrl, miniUrl, maintainer = true, wasOnVacation = false }) {
  const tr = strings(pet.lang);
  const c = tr.command;
  const header = `### ${MOOD_EMOJI[pet.mood]} ${pet.displayName}`;
  const kind = `**${pet.rank.emoji} ${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}** · ${tr.moods[pet.mood]}${pet.shiny ? ' ✨' : ''}${pet.aura ? ' 💥' : ''}${pet.path ? ` · ${pet.path.emoji} ${tr.paths[pet.path.id]}` : ''}`;
  const help = [
    // Just the names: `/pet help` explains each one.
    `<sub>${c.commands}: ${COMMANDS.map((name) => `\`/pet${name === 'status' ? '' : ` ${name}`}\``).join(' · ')}</sub>`,
  ];
  const care = checkup(pet, snapshot).map((item) => `- ${CHECK_ICON[item.level]} ${item.icon} ${item.text}`);
  const vitals = ['fullness', 'health', 'joy', 'energy', 'hygiene'].filter((k) => pet.vitals[k] != null);
  const table = [
    `| ${vitals.map((k) => tr.stats[k]).join(' | ')} |`,
    `| ${vitals.map(() => '---').join(' | ')} |`,
    `| ${vitals.map((k) => pet.vitals[k]).join(' | ')} |`,
  ];

  if (command === 'pat' || command === 'feed' || command === 'play') {
    const bonus = careBonus(pet.care, pet.date);
    const boost = bonus.fullness + bonus.energy + bonus.joy;
    const friends = topFriends(pet.care).map(([login, n]) => `@${login} (${n})`);
    return [
      header, '', `> ${careReply(pet, tr, { command, user })}`, '',
      ...(miniUrl && pet.careOutcome !== 'again' ? [`<img src="${miniUrl}" alt="${pet.displayName}" width="160">`, ''] : []),
      ...(boost ? [`🍪 ${c.snack(boost)} · 🍖 ${pet.vitals.fullness} · ⚡ ${pet.vitals.energy} · 😊 ${pet.vitals.joy}`, ''] : []),
      ...(friends.length ? [`<sub>💝 ${c.friends}: ${friends.join(' · ')}</sub>`, ''] : []),
      ...help,
    ].join('\n');
  }
  if (MAINTAINER_COMMANDS.has(command) && !maintainer) return [header, '', `> ${c.maintainersOnly(command)}`, '', ...help].join('\n');
  if (command === 'quests') {
    const q = pet.quests;
    return [
      header, '', `#### 📜 ${tr.questBoard.title}${q ? ` · ${tr.questBoard.ends(q.ends)}` : ''}`, '', ...questLines(pet, tr), '',
      `⭐ ${tr.questBoard.stars(pet.questStars ?? 0)}`, '', `<sub>${tr.questBoard.reward}</sub>`, '', ...help,
    ].join('\n');
  }
  if (command === 'wardrobe') {
    const w = pet.wardrobe ?? { worn: [], unlocked: [] };
    const progress = { achievements: pet.achievementsMap, stars: pet.questStars, friends: pet.care?.total ?? 0 };
    const rows = SLOTS.map((slot) => {
      const items = ITEMS.filter((i) => i.slot === slot).map((i) => {
        if (w.worn.includes(i.id)) return `**${itemName(tr, i.id)}** 👈`;
        return isUnlocked(i, progress) ? `${itemName(tr, i.id)} \`${i.id}\`` : `🔒 ${tr.items[i.id]} <sub>(${unlockHint(tr, i)})</sub>`;
      });
      return `- **${tr.slots[slot]}**: ${items.join(' · ')}`;
    });
    return [
      header, '', `#### 👗 ${c.wardrobe.title(w.unlocked.length, ITEMS.length)}`, '',
      `${c.wardrobe.wearing}: ${w.worn.length ? w.worn.map((id) => itemName(tr, id)).join(', ') : `_${c.wardrobe.nothing}_`}`, '',
      ...rows, '', `<sub>${c.wardrobe.how}</sub>`, '', ...help,
    ].join('\n');
  }
  if (command === 'wear') {
    const asked = parseWear(arg) ?? [];
    const worn = pet.wardrobe?.worn ?? [];
    const wearing = c.wear.done(worn.map((id) => itemName(tr, id)).join(', '));
    const problems = (pet.wardrobe?.rejected ?? []).filter(([id]) => asked.includes(id)).map(([id, why]) => (why === 'unknown'
      ? c.wear.unknown(id)
      : c.wear.locked(tr.items[id], unlockHint(tr, itemById(id)))));
    const text = [...problems, ...(worn.length && (!asked.length || asked.some((id) => worn.includes(id))) ? [wearing] : [])].join(' ') || c.wear.removed;
    return [
      header, '', `> ${text}`, '',
      ...(miniUrl ? [`<img src="${miniUrl}" alt="${pet.displayName}" width="160">`, ''] : []), ...help,
    ].join('\n');
  }
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

export async function answerCommand(client, { owner, repo, request, pet, snapshot, cardUrl, miniUrl, wasOnVacation }) {
  const base = `/repos/${owner}/${repo}`;
  await client.post(`${base}/issues/comments/${request.commentId}/reactions`, { content: REACTION[request.command] }).catch(() => {});
  const body = commandReply(pet, snapshot, {
    command: request.command, user: request.user, arg: request.arg, cardUrl, miniUrl, maintainer: request.maintainer, wasOnVacation,
  });
  return client.post(`${base}/issues/${request.issue}/comments`, { body });
}
