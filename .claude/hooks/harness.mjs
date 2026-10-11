#!/usr/bin/env node
/**
 * Claude Code harness: một file hook dùng chung cho mọi dự án (Node >= 18, không cần dependency).
 *
 * Hook (được gọi từ .claude/settings.json):
 *   turn-start   UserPromptSubmit  ghi mốc thời gian bắt đầu lượt
 *   guard        PreToolUse        hỏi lại trước lệnh nguy hiểm, đọc/ghi file bí mật, sửa tay lockfile
 *   after-edit   PostToolUse       ghi nhận file vừa sửa + chạy Prettier nếu dự án dùng Prettier
 *   verify       Stop              typecheck / lint / kiểm tra cú pháp các file đổi trong lượt;
 *                                  có lỗi MỚI thì chặn dừng để Claude tự sửa (tối đa maxRounds lần)
 * CLI:
 *   node .claude/hooks/harness.mjs doctor            harness nhận diện dự án thế nào
 *   node .claude/hooks/harness.mjs baseline          ghi nhận lỗi typecheck đang có (để chỉ bắt lỗi mới)
 *   node .claude/hooks/harness.mjs check [file...]   chạy kiểm tra như hook Stop rồi in kết quả
 *
 * Cấu hình: .claude/harness.json. Mã nguồn gốc và hướng dẫn: D:\claude-harness
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_VERSION = '1.0.0';
const IS_WIN = process.platform === 'win32';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(process.env.CLAUDE_PROJECT_DIR || join(SCRIPT_DIR, '..', '..'));
// Trạng thái để ngoài repo để không phải sửa .gitignore của dự án.
const STATE_DIR = join(
  homedir(), '.claude', 'harness-state',
  `${basename(PROJECT_DIR).replace(/[^\w.-]+/g, '_')}-${createHash('sha1').update(PROJECT_DIR.toLowerCase()).digest('hex').slice(0, 10)}`,
);

const DEFAULTS = {
  format: true,
  guard: { dangerous: true, secrets: true, extraAsk: [] },
  verify: { enabled: true, typecheck: true, lint: true, syntax: true, maxRounds: 2, commandTimeoutSec: 180, budgetSec: 300 },
  // Ghi đè theo package (khóa là đường dẫn tương đối, "." = gốc):
  //   { "format": false, "typecheck": false | "auto" | "<lệnh shell>", "lint": false | "auto" | "<lệnh shell>" }
  packages: {},
  php: null,
  python: null,
};

// ---------------------------------------------------------------- tiện ích chung

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toPosix = (p) => p.split(sep).join('/');
const relPath = (p) => toPosix(relative(PROJECT_DIR, p)) || '.';
const norm = (p) => (IS_WIN ? resolve(p).toLowerCase() : resolve(p));
const major = (v) => parseInt(String(v ?? '0'), 10) || 0;
const firstLine = (s) => String(s ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

function readText(file) {
  try { return readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); } catch { return null; }
}

function readJson(file) {
  const t = readText(file);
  if (t == null) return null;
  try { return JSON.parse(t); } catch { return null; }
}

// tsconfig cho phép comment và dấu phẩy thừa.
function readJsonc(file) {
  const src = readText(file);
  if (src == null) return null;
  let out = '';
  for (let i = 0, inStr = false; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
    } else {
      out += c;
    }
  }
  try { return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')); } catch { return null; }
}

function isInside(p, root = PROJECT_DIR) {
  const r = relative(root, p);
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.expo', '.turbo', '.vercel', '.output',
  'coverage', 'vendor', '__pycache__', '.venv', 'venv', 'Pods',
]);
const isSkipped = (p) => relPath(p).split('/').some((seg) => SKIP_DIRS.has(seg));

function mtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

function findUp(startDir, names, stopAt = PROJECT_DIR) {
  let dir = startDir;
  while (isInside(dir, stopAt)) {
    for (const n of names) {
      const p = join(dir, n);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function hasPackageKey(fromDir, key) {
  let dir = fromDir;
  while (isInside(dir)) {
    const pj = readJson(join(dir, 'package.json'));
    if (pj && key in pj) return true;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

function packageDirOf(file) {
  const pj = findUp(dirname(file), ['package.json']);
  return pj ? dirname(pj) : null;
}

// Tìm node_modules/<name> giống cách Node resolve (đi ngược lên, kể cả ngoài dự án khi hoist).
function findModule(fromDir, name) {
  let dir = fromDir;
  for (;;) {
    const pj = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(pj)) {
      const meta = readJson(pj);
      if (meta) return { dir: dirname(pj), meta };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function binOf(mod, name) {
  const b = typeof mod.meta.bin === 'string' ? mod.meta.bin : mod.meta.bin?.[name];
  return b ? join(mod.dir, b) : null;
}

function run(cmd, args, { cwd = PROJECT_DIR, timeoutSec = 60, shell = false, env } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, shell, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutSec * 1000, env: env ? { ...process.env, ...env } : process.env,
  });
  return {
    code: r.status,
    out: r.stdout ?? '',
    err: r.stderr ?? '',
    timedOut: r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal != null),
    error: r.error,
  };
}

const git = (args, cwd = PROJECT_DIR) => run('git', args, { cwd, timeoutSec: 20 });

const whichCache = new Map();
function which(name) {
  if (whichCache.has(name)) return whichCache.get(name);
  const exts = IS_WIN ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  let found = null;
  for (const d of (process.env.PATH ?? '').split(delimiter)) {
    if (!d || found) continue;
    for (const e of exts) {
      const p = join(d, name + e);
      if (existsSync(p)) { found = p; break; }
    }
  }
  whichCache.set(name, found);
  return found;
}

// ---------------------------------------------------------------- cấu hình và trạng thái

let configCache;
const config = () => (configCache ??= merge(DEFAULTS, readJson(join(PROJECT_DIR, '.claude', 'harness.json')) ?? {}));

function packageConfig(pkgDir) {
  return { format: config().format, typecheck: 'auto', lint: 'auto', ...(config().packages?.[relPath(pkgDir)] ?? {}) };
}

const sid = (input) => String(input.session_id || 'manual').replace(/[^\w-]/g, '').slice(0, 80) || 'manual';
const ensureStateDir = () => mkdirSync(STATE_DIR, { recursive: true });
const turnFile = (s) => join(STATE_DIR, `turn-${s}.json`);
const editsFile = (s) => join(STATE_DIR, `edits-${s}.log`);
const baselineFile = () => join(STATE_DIR, 'tsc-baseline.json');

const readTurn = (s) => readJson(turnFile(s)) ?? {};
function writeTurn(s, data) {
  ensureStateDir();
  writeFileSync(turnFile(s), JSON.stringify(data));
}
function readEdits(s) {
  const t = readText(editsFile(s));
  return t ? [...new Set(t.split('\n').filter(Boolean))] : [];
}
function recordEdit(s, file) {
  ensureStateDir();
  appendFileSync(editsFile(s), `${file}\n`); // append: an toàn khi nhiều Edit chạy song song
}
function finishTurn(s) {
  writeTurn(s, { startedAt: Date.now(), rounds: 0 });
  rmSync(editsFile(s), { force: true });
}
function cleanupState() {
  try {
    const cutoff = Date.now() - 7 * 864e5;
    for (const f of readdirSync(STATE_DIR)) {
      if (/^(turn|edits)-/.test(f) && mtime(join(STATE_DIR, f)) < cutoff) rmSync(join(STATE_DIR, f), { force: true });
    }
  } catch { /* chưa có thư mục trạng thái */ }
}

// Nhật ký sự kiện ngắn gọn (xem bằng `doctor`), tự cắt khi quá ~200 KB.
function log(line) {
  try {
    ensureStateDir();
    const file = join(STATE_DIR, 'events.log');
    if (mtime(file) && statSync(file).size > 200_000) writeFileSync(file, readText(file).slice(-100_000));
    appendFileSync(file, `${new Date().toISOString()} ${line.replace(/\s*\n\s*/g, ' | ')}\n`);
  } catch { /* không để việc ghi log làm hỏng hook */ }
}

const loadBaselines = () => readJson(baselineFile()) ?? {};
function saveBaselines(entries) {
  if (!entries.length) return;
  const b = loadBaselines();
  for (const { id, counts } of entries) b[id] = { counts, at: new Date().toISOString() };
  ensureStateDir();
  writeFileSync(baselineFile(), JSON.stringify(b));
}

async function readInput() {
  if (process.stdin.isTTY) return {};
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw); } catch { return {}; }
}

const emit = (obj) => process.stdout.write(JSON.stringify(obj));

// ---------------------------------------------------------------- guard (PreToolUse)

// File khoá / keystore / lockfile được chặn bằng permissions.ask trong settings.json (installer thêm vào,
// không tốn process). Hook chỉ được gọi cho .env* (qua trường "if") và mọi lệnh Bash/PowerShell.
const SECRET_NAME = /^(\.env(\.[\w.-]+)?|.+\.(pem|key|p12|pfx|p8|jks|keystore)|id_(rsa|dsa|ecdsa|ed25519)|credentials\.json|service[-_]?account.*\.json|.*firebase-adminsdk.*\.json)$/i;
const SECRET_SAFE = /\.(example|sample|template|tmpl|dist|defaults?|schema)$/i;

function isSecretFile(p) {
  const b = basename(String(p).replace(/[\\/]+$/, ''));
  return SECRET_NAME.test(b) && !SECRET_SAFE.test(b);
}

// Bỏ thân heredoc và nội dung trong ngoặc kép trước khi so, để commit message như
// "fix: graceful shutdown" hay file viết bằng heredoc không bị bắt nhầm.
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g;
const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/g;
const segments = (command) => command.split(/&&|\|\||[;|\n]/);

// [regex, lý do, 'raw' nếu cần so cả nội dung trong ngoặc (SQL thường nằm trong chuỗi)]
const DANGEROUS = [
  [/\bgit\s+push\b[^|;&\n]*(\s--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+[\w./-]+|--force-with-lease|--force-if-includes)/, 'git push --force ghi đè lịch sử trên remote'],
  [/\bgit\s+reset\b[^|;&\n]*\s--hard\b/, 'git reset --hard xoá thay đổi chưa commit'],
  [/\bgit\s+clean\b[^|;&\n]*\s-[a-zA-Z]*f/, 'git clean -f xoá file chưa track'],
  [/\bgit\s+(checkout|restore)\b[^|;&\n]*\s(--\s+)?\.(\s|$)/, 'bỏ toàn bộ thay đổi chưa commit (checkout/restore .)'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'xoá git stash'],
  [/\bgit\s+branch\b[^|;&\n]*\s-D\b/, 'xoá branch bằng -D'],
  [/\bgit\s+(filter-branch|filter-repo)\b|\bgit\s+update-ref\s+-d\b/, 'viết lại lịch sử git'],
  [/\b(drop\s+(database|schema|table)|truncate\s+table)\b/i, 'lệnh SQL xoá dữ liệu', 'raw'],
  [/\bprisma\s+(migrate\s+reset|db\s+push\b[^|;&\n]*--(force-reset|accept-data-loss))/, 'Prisma reset hoặc xoá dữ liệu DB'],
  [/\bsupabase\s+(db\s+(reset|push)|functions\s+deploy|secrets\s+set)\b/, 'thay đổi Supabase (DB / functions / secrets)'],
  [/\b(rails|rake)\s+db:(drop|reset|schema:load)\b|\bmigrate:(fresh|reset|refresh)\b|\bschema:drop\b/, 'xoá hoặc reset database'],
  [/\bdocker(-compose|\s+compose)?\s+(system\s+prune|volume\s+(rm|prune)|down\b[^|;&\n]*\s(-v|--volumes)\b)/, 'xoá Docker volume (mất dữ liệu DB)'],
  [/\b(npm|pnpm|yarn)\s+(npm\s+)?publish\b/, 'publish package lên registry'],
  [/\beas(-cli)?\s+(build|submit|update)\b|\bexpo\s+publish\b/, 'EAS build/submit/update (tốn credit hoặc đẩy bản cập nhật tới người dùng)'],
  [/\bvercel\b[^|;&\n]*--prod\b|\bnetlify\s+deploy\b[^|;&\n]*--prod\b|\bfirebase\s+deploy\b|\bfly(ctl)?\s+deploy\b|\brailway\s+up\b|\bwrangler\s+(deploy|publish)\b|\bdocker\s+push\b/, 'deploy/publish ra môi trường thật'],
  [/\bgh\s+(pr\s+merge|release\s+(create|delete)|repo\s+(delete|archive))\b/, 'thao tác GitHub ảnh hưởng ra bên ngoài'],
  [/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^;&\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\|\s*(iex|Invoke-Expression)\b/i, 'chạy script tải trực tiếp từ Internet'],
  [/\bchmod\s+(-R\s+)?777\b/, 'chmod 777'],
];
// Chỉ tính khi đứng ở đầu một lệnh.
const SYSTEM_DANGER = /^\s*(sudo\s+)?(mkfs\S*|diskpart|shutdown|reboot|format\s+[a-z]:|dd\s+if=|reg\s+delete)(\s|$)/i;

const ROOTISH = /^(\/|\/\*|~|~\/\*?|\$HOME\/?\*?|\$\{?CLAUDE_PROJECT_DIR\}?\/?\*?|\$env:USERPROFILE\\?|\*|\.\/?\*?|\.\.\/?\*?|[a-z]:[\\/]?\*?|\/[a-z]\/?\*?)$/i;

// rm -rf / Remove-Item -Recurse nhắm vào ổ đĩa, HOME, thư mục dự án hoặc thư mục cha của nó.
function recursiveDeleteOfRoot(command) {
  for (const seg of segments(command)) {
    const t = seg.trim().split(/\s+/).map((x) => x.replace(/^["']+|["']+$/g, ''));
    let i = 0;
    while (t[i] === 'sudo' || t[i] === 'command') i++;
    const cmd = (t[i] ?? '').toLowerCase();
    const args = t.slice(i + 1);
    let recursive = false;
    let targets = [];
    if (cmd === 'rm') {
      recursive = args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === '--recursive');
      targets = args.filter((a) => !a.startsWith('-'));
    } else if (['remove-item', 'ri', 'rd', 'rmdir', 'del', 'erase'].includes(cmd)) {
      recursive = args.some((a) => /^[-/](r|recurse|s)$/i.test(a));
      targets = args.filter((a) => !/^-/.test(a) && !/^\/[a-z]$/i.test(a));
    }
    if (!recursive) continue;
    for (const target of targets) {
      if (ROOTISH.test(target)) return true;
      const winPath = target.replace(/^\/([a-z])(\/|$)/i, '$1:/');
      if (isAbsolute(winPath) && isInside(PROJECT_DIR, resolve(winPath))) return true;
    }
  }
  return false;
}

function guard(input) {
  const cfg = config().guard;
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  let reason = null;

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(ti.command ?? '');
    const body = command.replace(HEREDOC, ' ');
    const bare = body.replace(QUOTED, '""');
    if (cfg.dangerous) {
      if (recursiveDeleteOfRoot(body)) reason = 'xoá đệ quy ổ đĩa / HOME / toàn bộ dự án';
      else if (segments(bare).some((seg) => SYSTEM_DANGER.test(seg))) reason = 'lệnh hệ thống nguy hiểm';
      else reason = DANGEROUS.find(([re, , scope]) => re.test(scope === 'raw' ? body : bare))?.[1] ?? null;
    }
    if (!reason && cfg.secrets) {
      const hits = [...new Set(body.split(/[\s"'`=<>|;&(),]+/).filter((tok) => tok && isSecretFile(tok)))];
      if (hits.length) reason = `lệnh đụng tới file bí mật: ${hits.join(', ')}`;
    }
    if (!reason) {
      for (const pattern of cfg.extraAsk ?? []) {
        try {
          if (new RegExp(pattern, 'i').test(body)) { reason = `khớp quy tắc riêng của dự án /${pattern}/`; break; }
        } catch { /* regex sai trong harness.json: bỏ qua */ }
      }
    }
  } else {
    const p = ti.file_path ?? ti.notebook_path;
    if (p && cfg.secrets && isSecretFile(p)) reason = `${tool} file bí mật ${basename(String(p))}`;
  }

  if (reason) {
    log(`guard ask: ${tool} · ${reason}`);
    emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[harness] ${reason}` } });
  }
}

// ---------------------------------------------------------------- format (PostToolUse)

const PRETTIER_CONFIGS = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yaml', '.prettierrc.yml', '.prettierrc.toml',
  '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.ts', '.prettierrc.cts', '.prettierrc.mts',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs', 'prettier.config.ts', 'prettier.config.cts', 'prettier.config.mts',
];

// Chỉ format khi package thật sự dùng Prettier (có cài + có config), tránh làm diff phình to.
function prettierFor(pkgDir) {
  const mod = findModule(pkgDir, 'prettier');
  if (!mod) return null;
  if (!findUp(pkgDir, PRETTIER_CONFIGS) && !hasPackageKey(pkgDir, 'prettier')) return null;
  const bin = binOf(mod, 'prettier');
  return bin ? { bin, version: mod.meta.version } : null;
}

function formatFile(file) {
  const pkg = packageDirOf(file);
  if (!pkg || packageConfig(pkg).format === false) return null;
  const pr = prettierFor(pkg);
  if (!pr) return null;
  const logFlag = major(pr.version) >= 3 ? '--log-level=warn' : '--loglevel=warn';
  const r = run(process.execPath, [pr.bin, '--write', '--ignore-unknown', logFlag, file], { cwd: pkg, timeoutSec: 30 });
  if (r.code === 0 || r.timedOut) return null;
  const detail = (r.err || r.out).trim().split(/\r?\n/).slice(0, 8).join('\n');
  return `[harness] Prettier không format được ${relPath(file)} (thường do lỗi cú pháp):\n${detail}`;
}

function afterEdit(input) {
  const p = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!p) return;
  const file = resolve(String(p));
  if (!isInside(file) || !existsSync(file)) return;
  recordEdit(sid(input), file);
  if (isSkipped(file)) return;
  const msg = formatFile(file);
  if (msg) emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg } });
}

function turnStart(input) {
  const s = sid(input);
  finishTurn(s);
  cleanupState();
}

// ---------------------------------------------------------------- kiểm tra (Stop / CLI)

const JS_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue']);
const TS_TRIGGER = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function gitChangedSince(sinceMs) {
  const top = git(['rev-parse', '--show-toplevel']);
  if (top.code !== 0) return [];
  const root = resolve(top.out.trim());
  const r = git(['status', '--porcelain', '-z', '--untracked-files=all']);
  if (r.code !== 0) return [];
  const files = [];
  const entries = r.out.split('\0');
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    const status = e.slice(0, 2);
    if (status[0] === 'R' || status[0] === 'C') i++; // entry kế tiếp là đường dẫn cũ
    if (status.includes('D')) continue;
    const abs = resolve(root, e.slice(3));
    if (isInside(abs) && mtime(abs) >= sinceMs) files.push(abs);
  }
  return files;
}

// Các dòng đã thêm/sửa so với HEAD; null = coi mọi dòng là mới (file chưa track, không có git).
const addedLinesCache = new Map();
function addedLines(file) {
  if (addedLinesCache.has(file)) return addedLinesCache.get(file);
  let lines = null;
  const dir = dirname(file);
  const name = basename(file);
  if (git(['ls-files', '--error-unmatch', '--', name], dir).code === 0) {
    const d = git(['diff', '--no-ext-diff', '--no-color', '-U0', 'HEAD', '--', name], dir);
    if (d.code === 0) {
      lines = new Set();
      for (const m of d.out.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const start = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        for (let k = 0; k < count; k++) lines.add(start + k);
      }
    }
  }
  addedLinesCache.set(file, lines);
  return lines;
}

// typecheck: false | "auto" | "<lệnh shell>" | { "tsconfig": "tsconfig.app.json" | [...] }
function typecheckPlans(pkg, pcfg, notes) {
  const tc = pcfg.typecheck;
  if (tc === false) return [];
  if (typeof tc === 'string' && tc !== 'auto') {
    return [{ id: `${relPath(pkg)}::${tc}`, label: tc, shell: tc, cwd: pkg }];
  }
  const explicit = isObj(tc) && tc.tsconfig ? [tc.tsconfig].flat().map((c) => resolve(pkg, c)) : null;
  const tsconfig = join(pkg, 'tsconfig.json');
  if (!explicit && !existsSync(tsconfig)) return [];
  const ts = findModule(pkg, 'typescript');
  if (!ts) {
    notes.push(`${relPath(pkg)}: bỏ qua typecheck vì chưa cài typescript (cần npm install)`);
    return [];
  }
  const tsc = binOf(ts, 'tsc') ?? join(ts.dir, 'bin', 'tsc');
  let configs = explicit ?? [tsconfig];
  const conf = explicit ? {} : readJsonc(tsconfig) ?? {};
  // tsconfig kiểu "solution" (files: [] + references), ví dụ template Vite: kiểm tra từng project con.
  if (Array.isArray(conf.files) && conf.files.length === 0 && !conf.include && conf.references?.length) {
    configs = conf.references.map((r) => {
      const p = resolve(pkg, r.path);
      try { return statSync(p).isDirectory() ? join(p, 'tsconfig.json') : p; } catch { return p; }
    });
  }
  return configs.filter((c) => existsSync(c)).map((c) => {
    const id = `${relPath(pkg)}::${relPath(c)}`;
    // --incremental với cache để ngoài repo: lần đầu chạy đủ, các lần sau chỉ kiểm tra phần thay đổi.
    const buildInfo = join(STATE_DIR, `tsc-${createHash('sha1').update(id).digest('hex').slice(0, 10)}.tsbuildinfo`);
    return {
      id,
      label: `tsc -p ${relPath(c)}`,
      cmd: process.execPath,
      args: [tsc, '--noEmit', '--pretty', 'false', '--incremental', '--tsBuildInfoFile', buildInfo, '-p', c],
      cwd: pkg,
    };
  });
}

function runTypecheck(plan, timeoutSec) {
  ensureStateDir();
  const t0 = Date.now();
  const r = plan.shell
    ? run(plan.shell, [], { cwd: plan.cwd, shell: true, timeoutSec })
    : run(plan.cmd, plan.args, { cwd: plan.cwd, timeoutSec });
  const ms = Date.now() - t0;
  if (r.timedOut) return { timedOut: true, ms };
  const raw = `${r.out}\n${r.err}`.replace(/\x1b\[[0-9;]*m/g, '');
  const errors = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/) ?? line.match(/^(.+?):(\d+):(\d+) - error (TS\d+): (.*)$/);
    if (m) errors.push({ file: resolve(plan.cwd, m[1].trim()), line: +m[2], col: +m[3], code: m[4], msg: m[5].trim() });
  }
  return { code: r.code, errors, raw, ms, configError: r.code !== 0 && errors.length === 0 };
}

const errKey = (e) => `${relPath(e.file)}|${e.code}|${e.msg}`;
function countKeys(errors) {
  const c = {};
  for (const e of errors) c[errKey(e)] = (c[errKey(e)] ?? 0) + 1;
  return c;
}

// Lỗi mới = lỗi không có trong baseline (so theo file + mã + thông điệp, không theo số dòng).
// Chưa có baseline thì chỉ xét lỗi nằm trong các file vừa đổi.
function freshErrors(errors, baseline, candidates) {
  if (!baseline) return errors.filter((e) => candidates.has(norm(e.file)));
  const seen = {};
  return errors.filter((e) => {
    const k = errKey(e);
    seen[k] = (seen[k] ?? 0) + 1;
    return seen[k] > (baseline[k] ?? 0);
  });
}

const ESLINT_FLAT = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const ESLINT_LEGACY = ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml'];

function eslintSetup(pkg, pcfg, notes) {
  if (pcfg.lint === false) return null;
  if (typeof pcfg.lint === 'string' && pcfg.lint !== 'auto') return { shell: pcfg.lint, label: pcfg.lint };
  const mod = findModule(pkg, 'eslint');
  if (!mod) return null;
  const v = major(mod.meta.version);
  const flat = findUp(pkg, ESLINT_FLAT);
  const legacy = findUp(pkg, ESLINT_LEGACY) || hasPackageKey(pkg, 'eslintConfig');
  if (!flat && !legacy) return null;
  const env = {};
  if (!flat && v >= 10) {
    notes.push(`${relPath(pkg)}: ESLint ${mod.meta.version} cần eslint.config.*; bỏ qua lint`);
    return null;
  }
  if (!flat && v === 9) env.ESLINT_USE_FLAT_CONFIG = 'false';
  if (flat && !legacy && v === 8) env.ESLINT_USE_FLAT_CONFIG = 'true';
  const bin = binOf(mod, 'eslint') ?? join(mod.dir, 'bin', 'eslint.js');
  return { bin, env, version: mod.meta.version, label: `eslint ${mod.meta.version}` };
}

function runEslint(pkg, files, pcfg, notes, timeoutSec) {
  const setup = eslintSetup(pkg, pcfg, notes);
  if (!setup) return null;
  const problems = [];
  if (setup.shell) {
    const quoted = files.map((f) => `"${f}"`).join(' ');
    const cmd = setup.shell.includes('{files}') ? setup.shell.replace('{files}', quoted) : setup.shell;
    const r = run(cmd, [], { cwd: pkg, shell: true, timeoutSec });
    if (r.timedOut) notes.push(`${setup.label}: quá thời gian`);
    else if (r.code !== 0) problems.push({ tool: 'lint', file: pkg, msg: `${setup.label} thất bại:\n${(r.out + r.err).trim().split(/\r?\n/).slice(-30).join('\n')}` });
    return { problems, label: setup.label };
  }
  const lintable = files.filter((f) => extname(f).toLowerCase() !== '.json');
  for (let i = 0; i < lintable.length; i += 40) {
    const chunk = lintable.slice(i, i + 40);
    const r = run(process.execPath, [setup.bin, '--format', 'json', '--quiet', ...chunk], { cwd: pkg, env: setup.env, timeoutSec });
    if (r.timedOut) { notes.push(`eslint (${relPath(pkg)}): quá thời gian`); break; }
    let results;
    try { results = JSON.parse(r.out.slice(r.out.indexOf('['))); } catch {
      notes.push(`eslint (${relPath(pkg)}) không chạy được: ${firstLine(r.err || r.out)}`);
      break;
    }
    for (const res of results) {
      const file = resolve(res.filePath);
      for (const m of res.messages ?? []) {
        if (m.severity !== 2 && !m.fatal) continue;
        const lines = m.fatal ? null : addedLines(file);
        if (lines && m.line && !lines.has(m.line)) continue; // lỗi cũ trên dòng không đổi
        problems.push({ tool: 'eslint', file, line: m.line, col: m.column, msg: `${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}` });
      }
    }
  }
  return { problems, label: `eslint ${lintable.length} file` };
}

function checkJson(file) {
  const b = basename(file).toLowerCase();
  if (/^(ts|js)config.*\.json$|\.jsonc$|^\.eslintrc\.json$|^devcontainer\.json$|^\.babelrc$/.test(b) || /[\\/]\.vscode[\\/]/.test(file)) return null;
  const t = readText(file);
  if (t == null || !t.trim()) return null;
  try { JSON.parse(t); return null; } catch (e) { return { tool: 'json', file, msg: e.message }; }
}

function phpBinary() {
  return config().php || which('php') || ['D:\\xampp\\php\\php.exe', 'C:\\xampp\\php\\php.exe'].find((p) => existsSync(p)) || null;
}

function checkPhp(file, notes) {
  const php = phpBinary();
  if (!php) { notes.push('bỏ qua php -l vì không tìm thấy php (đặt "php" trong .claude/harness.json)'); return null; }
  const r = run(php, ['-l', file], { timeoutSec: 30 });
  if (r.code === 0) return null;
  const line = `${r.out}\n${r.err}`.split(/\r?\n/).find((l) => /error/i.test(l)) ?? 'lỗi cú pháp PHP';
  const m = line.match(/on line (\d+)/);
  return { tool: 'php -l', file, line: m ? +m[1] : undefined, msg: line.replace(/\s+in\s+.+? on line \d+\s*$/, '').trim() };
}

function checkPython(file, notes) {
  const py = config().python || which('python') || which('python3');
  if (!py) { notes.push('bỏ qua kiểm tra Python vì không tìm thấy python'); return null; }
  // -I: không nạp module từ thư mục hiện tại (tránh file ast.py của dự án che thư viện chuẩn).
  const r = run(py, ['-I', '-c', 'import ast,sys;ast.parse(open(sys.argv[1],"rb").read(),sys.argv[1])', file], { timeoutSec: 30 });
  if (r.code === 0) return null;
  const lines = r.err.trim().split(/\r?\n/);
  const ln = [...r.err.matchAll(/line (\d+)/g)].pop();
  return { tool: 'python', file, line: ln ? +ln[1] : undefined, msg: lines.at(-1) };
}

function runChecks(files) {
  const v = config().verify;
  const problems = [];
  const ran = [];
  const notes = [];
  const tscResults = [];
  const deadline = Date.now() + v.budgetSec * 1000;
  const timeLeft = () => Math.max(5, Math.min(v.commandTimeoutSec, Math.floor((deadline - Date.now()) / 1000)));
  const candidates = new Set(files.map(norm));
  const byPkg = new Map();
  let syntaxCount = 0;

  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (JS_EXT.has(ext)) {
      const pkg = packageDirOf(f);
      if (pkg) byPkg.set(pkg, [...(byPkg.get(pkg) ?? []), f]);
    } else if (v.syntax && (ext === '.json' || ext === '.php' || ext === '.py')) {
      const p = ext === '.json' ? checkJson(f) : ext === '.php' ? checkPhp(f, notes) : checkPython(f, notes);
      syntaxCount++;
      if (p) problems.push(p);
    }
  }
  if (syntaxCount) ran.push(`cú pháp ${syntaxCount} file`);

  const baselines = loadBaselines();
  for (const [pkg, pkgFiles] of byPkg) {
    const pcfg = packageConfig(pkg);
    if (v.typecheck && pkgFiles.some((f) => TS_TRIGGER.has(extname(f).toLowerCase()))) {
      for (const plan of typecheckPlans(pkg, pcfg, notes)) {
        if (Date.now() > deadline) { notes.push(`hết thời gian nên bỏ qua ${plan.label}`); continue; }
        const res = runTypecheck(plan, timeLeft());
        if (res.timedOut) { notes.push(`${plan.label}: quá thời gian (${Math.round(res.ms / 1000)}s)`); continue; }
        if (res.configError) { notes.push(`${plan.label}: thoát mã ${res.code} nhưng không đọc được lỗi. ${firstLine(res.raw)}`); continue; }
        const fresh = freshErrors(res.errors, baselines[plan.id]?.counts, candidates);
        problems.push(...fresh.map((e) => ({ tool: 'tsc', ...e })));
        tscResults.push({ id: plan.id, counts: countKeys(res.errors), fresh, hadBaseline: Boolean(baselines[plan.id]) });
        ran.push(`${plan.label} ${(res.ms / 1000).toFixed(1)}s`);
      }
    }
    if (v.lint && Date.now() < deadline) {
      const res = runEslint(pkg, pkgFiles, pcfg, notes, timeLeft());
      if (res) { problems.push(...res.problems); ran.push(res.label); }
    }
  }
  return { problems, ran, notes, tscResults };
}

function fmtProblem(p) {
  const loc = p.line ? `:${p.line}${p.col ? `:${p.col}` : ''}` : '';
  return `- [${p.tool}] ${relPath(p.file)}${loc} ${p.code ? `${p.code} ` : ''}${p.msg}`;
}

function listProblems(problems, max) {
  const shown = problems.slice(0, max).map(fmtProblem).join('\n');
  return problems.length > max ? `${shown}\n… và ${problems.length - max} lỗi khác` : shown;
}

function verifyHook(input) {
  const cfg = config();
  if (!cfg.verify.enabled) return;
  const s = sid(input);
  const turn = readTurn(s);

  const byKey = new Map();
  const add = (f) => {
    const a = resolve(f);
    if (existsSync(a) && isInside(a) && !isSkipped(a)) byKey.set(norm(a), a);
  };
  readEdits(s).forEach(add);
  if (turn.startedAt) gitChangedSince(turn.startedAt - 2000).forEach(add);
  const files = [...byKey.values()];

  if (!files.length) {
    if (turn.rounds) finishTurn(s);
    return;
  }

  // Bị chặn rồi mà Claude không sửa thêm gì: coi như lỗi có sẵn và đã được giải thích, nên không chặn nữa.
  if (input.stop_hook_active && turn.blockedAt && files.every((f) => mtime(f) < turn.blockedAt)) {
    saveBaselines(turn.pending ?? []);
    finishTurn(s);
    log('verify: Claude không sửa thêm sau cảnh báo → ghi nhận lỗi vào baseline');
    emit({ systemMessage: '[harness] Claude không sửa thêm sau cảnh báo. Các lỗi đã báo được ghi nhận là lỗi có sẵn.' });
    return;
  }

  const res = runChecks(files);
  const notes = res.notes.length ? ` | lưu ý: ${res.notes.join('; ')}` : '';

  if (!res.problems.length) {
    saveBaselines(res.tscResults);
    finishTurn(s);
    log(`verify ok (${files.length} file): ${res.ran.join(' · ')}${notes}`);
    if (res.ran.length || notes) emit({ systemMessage: `[harness] ✓ ${res.ran.join(' · ') || 'không có bước kiểm tra nào áp dụng'}${notes}` });
    return;
  }

  const round = (turn.rounds ?? 0) + 1;
  if (round > cfg.verify.maxRounds) {
    saveBaselines(res.tscResults);
    finishTurn(s);
    log(`verify bỏ cuộc: còn ${res.problems.length} lỗi sau ${cfg.verify.maxRounds} lượt`);
    emit({ systemMessage: `[harness] Vẫn còn ${res.problems.length} lỗi sau ${cfg.verify.maxRounds} lượt tự sửa. Bạn nên xem lại:\n${listProblems(res.problems, 15)}` });
    return;
  }
  log(`verify chặn (lần ${round}): ${res.problems.length} lỗi mới, ví dụ ${fmtProblem(res.problems[0])}`);

  // Lần đầu chưa có baseline: ghi nhận các lỗi KHÔNG bị báo là lỗi có sẵn.
  saveBaselines(res.tscResults.filter((r) => !r.hadBaseline).map((r) => {
    const counts = { ...r.counts };
    for (const e of r.fresh) if (--counts[errKey(e)] <= 0) delete counts[errKey(e)];
    return { id: r.id, counts };
  }));
  writeTurn(s, {
    ...turn, rounds: round, blockedAt: Date.now(),
    pending: res.tscResults.map((r) => ({ id: r.id, counts: r.counts })),
  });
  emit({
    decision: 'block',
    reason: [
      `[harness] Kiểm tra tự động (lần ${round}/${cfg.verify.maxRounds}) thấy ${res.problems.length} lỗi mới sau thay đổi trong lượt này:`,
      listProblems(res.problems, 40),
      '',
      'Hãy sửa các lỗi này rồi mới kết thúc. Lỗi tsc có thể nằm ở file khác bị ảnh hưởng bởi thay đổi của bạn.',
      'Nếu chắc chắn lỗi không do thay đổi của bạn gây ra, hãy giải thích ngắn cho người dùng rồi dừng, đừng sửa thêm file. Khi đó harness sẽ ghi nhận và không chặn lại.',
    ].join('\n'),
  });
}

// ---------------------------------------------------------------- CLI

function discoverPackages() {
  const out = [];
  const walk = (dir, depth) => {
    if (existsSync(join(dir, 'package.json'))) out.push(dir);
    if (depth >= 3) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name), depth + 1);
    }
  };
  walk(PROJECT_DIR, 0);
  return out;
}

function doctor() {
  const baselines = loadBaselines();
  console.log(`claude harness ${HARNESS_VERSION}`);
  console.log(`dự án     : ${PROJECT_DIR}`);
  console.log(`cấu hình  : ${existsSync(join(PROJECT_DIR, '.claude', 'harness.json')) ? '.claude/harness.json' : '(mặc định)'}`);
  console.log(`trạng thái: ${STATE_DIR}`);
  const pkgs = discoverPackages();
  if (!pkgs.length) console.log('\n(không có package.json, chỉ dùng guard và kiểm tra cú pháp)');
  for (const pkg of pkgs) {
    const pcfg = packageConfig(pkg);
    const notes = [];
    const pr = prettierFor(pkg);
    const plans = typecheckPlans(pkg, pcfg, notes);
    const es = eslintSetup(pkg, pcfg, notes);
    console.log(`\n[${relPath(pkg)}]`);
    console.log(`  format    : ${pcfg.format === false ? 'tắt' : pr ? `prettier ${pr.version}` : 'không (thiếu prettier hoặc config)'}`);
    console.log(`  typecheck : ${pcfg.typecheck === false ? 'tắt' : plans.length ? plans.map((p) => {
      const b = baselines[p.id];
      return `${p.label} [baseline: ${b ? `${Object.values(b.counts).reduce((a, n) => a + n, 0)} lỗi có sẵn` : 'chưa có'}]`;
    }).join(' | ') : 'không'}`);
    console.log(`  lint      : ${pcfg.lint === false ? 'tắt' : es ? es.label : 'không'}`);
    for (const n of notes) console.log(`  ! ${n}`);
  }
  console.log(`\nphp       : ${phpBinary() ?? '(không có)'}`);
  console.log(`python    : ${config().python || which('python') || '(không có)'}`);
  const events = readText(join(STATE_DIR, 'events.log'))?.trim().split('\n').slice(-8) ?? [];
  if (events.length) console.log(`\nsự kiện gần đây:\n  ${events.join('\n  ')}`);
}

function baselineCmd() {
  const entries = [];
  for (const pkg of discoverPackages()) {
    const notes = [];
    for (const plan of typecheckPlans(pkg, packageConfig(pkg), notes)) {
      process.stdout.write(`${plan.label} (${relPath(pkg)}) ... `);
      const r = runTypecheck(plan, config().verify.commandTimeoutSec);
      if (r.timedOut) { console.log(`QUÁ THỜI GIAN (${Math.round(r.ms / 1000)}s)`); continue; }
      if (r.configError) { console.log(`không chạy được: ${firstLine(r.raw)}`); continue; }
      entries.push({ id: plan.id, counts: countKeys(r.errors) });
      console.log(`${r.errors.length} lỗi có sẵn, ${(r.ms / 1000).toFixed(1)}s`);
    }
    for (const n of notes) console.log(`  ! ${n}`);
  }
  saveBaselines(entries);
  if (!entries.length) console.log('(không có bước typecheck nào để ghi baseline)');
}

function checkCmd(args) {
  const files = (args.length ? args.map((f) => resolve(f)) : gitChangedSince(0)).filter((f) => existsSync(f) && !isSkipped(f));
  const res = runChecks(files);
  console.log(`Kiểm tra ${files.length} file: ${res.ran.join(' · ') || '(không có bước nào áp dụng)'}`);
  for (const n of res.notes) console.log(`! ${n}`);
  if (res.problems.length) {
    console.log(listProblems(res.problems, 200));
    process.exitCode = 1;
  } else {
    console.log('Không có lỗi mới.');
  }
}

const USAGE = `claude harness ${HARNESS_VERSION}
  hook: turn-start | guard | after-edit | verify   (đọc JSON từ stdin)
  cli : doctor | baseline | check [file...]`;

const HOOKS = { 'turn-start': turnStart, guard, 'after-edit': afterEdit, verify: verifyHook };
const [sub, ...rest] = process.argv.slice(2);
try {
  if (HOOKS[sub]) HOOKS[sub](await readInput());
  else if (sub === 'doctor') doctor();
  else if (sub === 'baseline') baselineCmd();
  else if (sub === 'check') checkCmd(rest);
  else {
    console.log(USAGE);
    if (sub) process.exitCode = 1;
  }
} catch (err) {
  // Lỗi nội bộ không được làm hỏng phiên làm việc: exit 1 = cảnh báo, không chặn Claude.
  process.stderr.write(`[harness] lỗi nội bộ (${sub}): ${err?.stack ?? err}\n`);
  process.exitCode = 1;
}
