// What the pet says in the terminal, in English and Vietnamese (like the app's notifications).
// Names of moods, ranks and species come from src/i18n, in every language.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const EN = {
  food: {
    feat: 'Something new? Cake for the new feature! 🍰',
    fix: 'An apple a day keeps the bugs away 🍎',
    docs: 'A fortune cookie! It says: “future you says thanks” 🥠',
    test: 'Tests are like broccoli: good for us 🥦',
    refactor: 'So tidy! Neat as an onigiri 🍙',
    style: 'Looking sharp! A neat little onigiri 🍙',
    perf: 'Zoom! I feel faster already ⚡',
    chore: 'A little snack between meals 🍪',
    ci: 'A cookie for the robots 🍪',
    build: 'A builder’s biscuit 🍪',
    revert: 'Undo! Leftovers taste fine too 🍪',
    wip: 'Work in progress? I’ll nibble slowly 🍪',
    merge: 'A whole bento of commits! 🍱',
    other: 'Nom nom! Thanks for the commit 🍖',
    water: 'Glug glug! Thanks for the commit 💧',
  },
  feast: (n) => `Whoa, a feast! ${n} lines in one bite 🍱`,
  amend: 'Back for seconds? (amended) 🍰',
  initial: 'The very first commit! A new story begins 🥚',
  egg: (n) => `*crack* … ${plural(n, 'more commit')} and I hatch 🥚`,
  // Highlights: the one thing worth saying out loud after a commit.
  hatched: (name) => `I hatched! Hi, I’m ${name} 🐣`,
  revived: 'I’m alive again! Thank you 💚',
  levelUp: (lv) => `Level up! I’m Lv.${lv} now ✨`,
  rankUp: (rank, emoji) => `Rank up: ${emoji} ${rank}!`,
  milestone: (n) => `Commit #${n}! What a ride 🎉`,
  streak: (n) => `${n}-day streak! Keep it burning 🔥`,
  first: 'First commit today! Breakfast time 🌞',
  night: 'Coding this late? Save it and get some sleep 🌙',
  weekend: 'A weekend commit! You really care 💛',
  banner: { levelUp: null, hatched: 'HATCHED!', revived: 'ALIVE!', rankUp: 'RANK UP!' },
  nom: 'nom!',

  push: (n, to) => (n > 0 ? `Off it goes! ${plural(n, 'commit')} to ${to} 🚀` : `Off it goes to ${to}! 🚀`),
  pushTag: (tag) => `Tag ${tag}! Is it release day? 🎉`,
  pushNew: (branch) => `A new branch takes off: ${branch} 🚀`,
  pushDelete: (branch) => `Waving goodbye to ${branch} 👋`,
  friday: 'A Friday evening push? Brave! 😅',

  pulled: (n) => (n > 0 ? `${plural(n, 'new commit')} arrived! 📦` : 'All caught up 📦'),
  from: (names, more) => `from ${names}${more ? ` and ${more} more` : ''}`,

  branch: (name) => `New path: ${name} 🌿`,
  home: (name) => `Back home on ${name} 🏡`,
  detached: (sha) => `Exploring ${sha} (detached HEAD) 🧭`,

  toNext: (n, lv) => `${plural(n, 'commit')} to Lv.${lv}`,
  maxLevel: 'Max level!',
  streakDays: (n) => `🔥 ${n}-day streak`,
  today: (n) => (n ? `${n} today` : 'none yet today'),
  lines: (add, del) => `+${add} −${del}`,
  last: (ago) => `last commit ${ago}`,
  ago: (min) => (min < 1 ? 'just now' : min < 60 ? `${Math.round(min)} min ago` : min < 48 * 60 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} days ago`),
  quests: (done, total) => `📜 quests ${done}/${total}`,
  trophies: (n) => `🏆 ${plural(n, 'trophy', 'trophies')}`,
  status: { dirty: (n) => `${plural(n, 'file')} changed`, ahead: (n) => `${n} to push`, behind: (n) => `${n} to pull`, clean: 'clean' },
  waking: 'waking up your pet…',

  live: {
    keys: '[f] feed  [p] play  [space] pat  [t] focus  [q] quit',
    hello: (name) => `Hi! ${name} will keep you company here.`,
    coding: 'You’re coding! I’ll keep you company 📝',
    bigChanges: (n) => `${plural(n, 'file')} changed. Commit a checkpoint? 💾`,
    longChanges: (min) => `${min} minutes of work not committed yet. A small commit is a good snack 💾`,
    clean: 'All clean! ✨',
    late: 'It’s late… commit, push, sleep 🌙',
    nap: 'Zzz… (a commit will wake me up)',
    focus: (min) => `Focus time: ${min} minutes. I’ll be quiet 🤫`,
    focusLeft: (left) => `🎯 focus ${left}`,
    focusDone: 'Break time! Stretch with me ☕',
    focusStop: 'Focus stopped. Whenever you’re ready!',
    fed: 'Yum! Thank you 💛',
    played: 'Again! Again! 🎾',
    patted: 'Hehe, that tickles 💛',
    again: 'I already had that today, thanks! 😊',
    cant: 'Not now… 💤',
    pushed: (to) => `Pushed to ${to}! 🚀`,
    bye: 'Bye! Keep shipping 👋',
    notRepo: 'Not a git repo: showing a demo pet.',
  },
};

const VI = {
  food: {
    feat: 'Có gì mới thế? Bánh kem mừng tính năng mới! 🍰',
    fix: 'Mỗi ngày một quả táo, bug chạy mất dép 🍎',
    docs: 'Bánh may mắn! Bên trong ghi: “bạn của tương lai cảm ơn bạn” 🥠',
    test: 'Test giống bông cải xanh: ăn vào là khỏe 🥦',
    refactor: 'Gọn gàng ghê! Tròn trịa như cơm nắm 🍙',
    style: 'Đẹp trai hẳn ra! Một nắm cơm xinh xắn 🍙',
    perf: 'Vèo! Thấy nhanh hơn hẳn rồi ⚡',
    chore: 'Một miếng bánh nhỏ giữa bữa 🍪',
    ci: 'Bánh quy cho mấy chú robot 🍪',
    build: 'Bánh quy cho thợ xây 🍪',
    revert: 'Quay xe! Đồ ăn thừa vẫn ngon mà 🍪',
    wip: 'Đang làm dở à? Mình gặm từ từ 🍪',
    merge: 'Nguyên một hộp bento commit! 🍱',
    other: 'Măm măm! Cảm ơn commit nhé 🍖',
    water: 'Ực ực! Cảm ơn commit nhé 💧',
  },
  feast: (n) => `Oa, cả một bữa tiệc! ${n} dòng trong một miếng 🍱`,
  amend: 'Xin thêm chén nữa à? (amend) 🍰',
  initial: 'Commit đầu tiên! Một câu chuyện mới bắt đầu 🥚',
  egg: (n) => `*rắc* … thêm ${n} commit nữa là mình nở 🥚`,
  hatched: (name) => `Mình nở rồi! Chào bạn, mình là ${name} 🐣`,
  revived: 'Mình sống lại rồi! Cảm ơn bạn 💚',
  levelUp: (lv) => `Lên cấp! Giờ mình là Lv.${lv} rồi ✨`,
  rankUp: (rank, emoji) => `Lên hạng: ${emoji} ${rank}!`,
  milestone: (n) => `Commit thứ ${n}! Một chặng đường dài 🎉`,
  streak: (n) => `Chuỗi ${n} ngày liên tục! Giữ lửa nhé 🔥`,
  first: 'Commit đầu tiên hôm nay! Ăn sáng thôi 🌞',
  night: 'Code khuya thế? Lưu lại rồi đi ngủ nhé 🌙',
  weekend: 'Commit cuối tuần! Bạn tận tâm quá 💛',
  banner: { levelUp: null, hatched: 'NỞ RỒI!', revived: 'SỐNG LẠI!', rankUp: 'LÊN HẠNG!' },
  nom: 'măm!',

  push: (n, to) => (n > 0 ? `Lên đường! ${n} commit bay tới ${to} 🚀` : `Lên đường tới ${to}! 🚀`),
  pushTag: (tag) => `Tag ${tag}! Hôm nay phát hành à? 🎉`,
  pushNew: (branch) => `Nhánh mới cất cánh: ${branch} 🚀`,
  pushDelete: (branch) => `Tạm biệt nhánh ${branch} 👋`,
  friday: 'Push chiều thứ Sáu? Gan thật đấy! 😅',

  pulled: (n) => (n > 0 ? `${n} commit mới vừa về! 📦` : 'Đã cập nhật hết rồi 📦'),
  from: (names, more) => `từ ${names}${more ? ` và ${more} người nữa` : ''}`,

  branch: (name) => `Lối mới: ${name} 🌿`,
  home: (name) => `Về nhà: ${name} 🏡`,
  detached: (sha) => `Đi thám hiểm ${sha} (detached HEAD) 🧭`,

  toNext: (n, lv) => `còn ${n} commit lên Lv.${lv}`,
  maxLevel: 'Cấp tối đa!',
  streakDays: (n) => `🔥 chuỗi ${n} ngày`,
  today: (n) => (n ? `${n} hôm nay` : 'hôm nay chưa có'),
  lines: (add, del) => `+${add} −${del}`,
  last: (ago) => `commit gần nhất ${ago}`,
  ago: (min) => (min < 1 ? 'vừa xong' : min < 60 ? `${Math.round(min)} phút trước` : min < 48 * 60 ? `${Math.round(min / 60)} giờ trước` : `${Math.round(min / 1440)} ngày trước`),
  quests: (done, total) => `📜 nhiệm vụ ${done}/${total}`,
  trophies: (n) => `🏆 ${n} cúp`,
  status: { dirty: (n) => `${n} file đã sửa`, ahead: (n) => `${n} chờ push`, behind: (n) => `${n} chờ pull`, clean: 'sạch' },
  waking: 'đang gọi thú cưng dậy…',

  live: {
    keys: '[f] cho ăn  [p] chơi  [space] vuốt ve  [t] tập trung  [q] thoát',
    hello: (name) => `Chào bạn! ${name} sẽ ở đây với bạn.`,
    coding: 'Bạn đang code! Mình ngồi đây với bạn nhé 📝',
    bigChanges: (n) => `${n} file đã sửa. Commit một mốc chứ? 💾`,
    longChanges: (min) => `${min} phút làm việc chưa commit. Một commit nhỏ là bữa ăn ngon đấy 💾`,
    clean: 'Sạch bong! ✨',
    late: 'Khuya rồi… commit, push, rồi ngủ nhé 🌙',
    nap: 'Khò khò… (commit để đánh thức mình)',
    focus: (min) => `Tập trung ${min} phút. Mình sẽ im lặng 🤫`,
    focusLeft: (left) => `🎯 tập trung ${left}`,
    focusDone: 'Giải lao thôi! Vươn vai với mình nào ☕',
    focusStop: 'Đã dừng. Khi nào sẵn sàng thì mình làm tiếp!',
    fed: 'Ngon quá! Cảm ơn bạn 💛',
    played: 'Nữa đi! Nữa đi! 🎾',
    patted: 'Hihi, nhột quá 💛',
    again: 'Hôm nay mình được rồi, cảm ơn nhé! 😊',
    cant: 'Để sau nhé… 💤',
    pushed: (to) => `Đã push lên ${to}! 🚀`,
    bye: 'Tạm biệt! Ship tiếp nhé 👋',
    notRepo: 'Không phải repo git: đây là thú cưng mẫu.',
  },
};

export const WORDS = { en: EN, vi: VI };
export const words = (lang) => WORDS[String(lang ?? '').slice(0, 2).toLowerCase()] ?? EN;

const ALIASES = {
  feat: 'feat', feature: 'feat', fix: 'fix', bugfix: 'fix', hotfix: 'fix', docs: 'docs', doc: 'docs',
  test: 'test', tests: 'test', refactor: 'refactor', style: 'style', perf: 'perf', chore: 'chore',
  ci: 'ci', build: 'build', revert: 'revert', wip: 'wip',
};
const GITMOJI = [
  [/^(:sparkles:|✨|🎉)/u, 'feat'], [/^(:bug:|🐛|🚑)/u, 'fix'], [/^(:memo:|📝)/u, 'docs'], [/^(:white_check_mark:|✅|🧪)/u, 'test'],
  [/^(:recycle:|♻)/u, 'refactor'], [/^(:zap:|⚡)/u, 'perf'], [/^(:art:|🎨|💄)/u, 'style'], [/^(:construction:|🚧)/u, 'wip'],
];

// What kind of commit this is, from its subject: Conventional Commits, gitmoji or plain words
// (English or Vietnamese). Decides what the pet gets to eat.
export function commitKind(subject = '', action = '') {
  const s = String(subject).trim();
  if (/^merge\b/i.test(s) || /\bmerge\b/.test(action)) return 'merge';
  if (/^revert\b/i.test(s)) return 'revert';
  const cc = /^(\w+)(\([^)]*\))?!?:/.exec(s);
  if (cc && ALIASES[cc[1].toLowerCase()]) return ALIASES[cc[1].toLowerCase()];
  for (const [re, kind] of GITMOJI) if (re.test(s)) return kind;
  const lower = s.toLowerCase();
  if (/\bwip\b/.test(lower)) return 'wip';
  if (/\b(fix|fixes|fixed|bug|bugs|patch|hotfix|resolve[sd]?)\b/.test(lower) || /sửa|lỗi/.test(lower)) return 'fix';
  if (/\b(docs?|readme|documentation|typo|changelog)\b/.test(lower) || /tài liệu/.test(lower)) return 'docs';
  if (/\b(tests?|specs?)\b/.test(lower) || /kiểm thử/.test(lower)) return 'test';
  if (/\b(refactor\w*|clean\s?up|tidy|rename\w*|simplif\w*)\b/.test(lower) || /tái cấu trúc|dọn/.test(lower)) return 'refactor';
  if (/\b(perf|faster|speed\s?up|optimi[sz]\w*)\b/.test(lower) || /tối ưu|nhanh hơn/.test(lower)) return 'perf';
  if (/\b(add|adds|added|feat|feature|new|implement\w*|introduce\w*|support)\b/.test(lower) || /thêm|tính năng/.test(lower)) return 'feat';
  return 'other';
}
