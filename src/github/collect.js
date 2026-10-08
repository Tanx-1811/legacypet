import { DAY } from '../util/time.js';
import { lastPageFromLink } from './client.js';

const STALE_DAYS = 30;
const NUDGE_DAYS = 7;
const RECENT_DAYS = 90;
const TREAT_DAYS = 14;
const MAINTAINERS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const FAILING = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);
const DEFAULT_IGNORED = /legacy-?pet/i;

const isBot = (user) => user?.type === 'Bot' || /\[bot\]$/.test(user?.login ?? '');
const ageInDays = (date, now) => (now.getTime() - new Date(date).getTime()) / DAY;

async function collectCommits(client, base, branch, now) {
  let head;
  try {
    head = await client.request('GET', `${base}/commits`, { query: { sha: branch, per_page: 1 } });
  } catch (err) {
    if (err.status === 409) return { total: 0, lastDate: null, recent: [] }; // empty repository
    throw err;
  }
  const latest = head.data?.[0];
  const since = new Date(now.getTime() - RECENT_DAYS * DAY).toISOString();
  const list = await client.get(`${base}/commits`, { query: { sha: branch, since, per_page: 100 } });
  return {
    total: lastPageFromLink(head.headers.get('link')) ?? (head.data?.length ?? 0),
    lastDate: latest ? latest.commit.committer?.date ?? latest.commit.author?.date : null,
    headSha: latest?.sha ?? null,
    recent: (list ?? []).map((c) => ({
      sha: c.sha,
      date: c.commit.committer?.date ?? c.commit.author?.date,
      author: c.author?.login ?? c.commit.author?.name ?? null,
      bot: isBot(c.author),
    })),
  };
}

function summarizeChecks(checks) {
  if (!checks.length) return { state: 'unknown', total: 0, failing: 0, failingNames: [] };
  const done = checks.filter((c) => c.state !== 'pending');
  if (!done.length) return { state: 'pending', total: checks.length, failing: 0, failingNames: [] };
  const failing = done.filter((c) => c.state === 'failing');
  return {
    state: failing.length ? 'failing' : 'passing',
    total: done.length,
    failing: failing.length,
    failingNames: failing.map((c) => c.name).slice(0, 3),
  };
}

async function ciForSha(client, base, sha, isIgnored) {
  const [runs, status] = await Promise.all([
    client.get(`${base}/commits/${sha}/check-runs`, { query: { per_page: 100, filter: 'latest' } }).catch(() => null),
    client.get(`${base}/commits/${sha}/status`).catch(() => null),
  ]);
  if (!runs && !status) return null;
  const checks = [];
  for (const run of runs?.check_runs ?? []) {
    if (isIgnored(run.name)) continue;
    if (run.status !== 'completed') checks.push({ name: run.name, state: 'pending' });
    else if (FAILING.has(run.conclusion)) checks.push({ name: run.name, state: 'failing' });
    else if (run.conclusion === 'success') checks.push({ name: run.name, state: 'passing' });
  }
  for (const s of status?.statuses ?? []) {
    if (isIgnored(s.context)) continue;
    checks.push({ name: s.context, state: s.state === 'pending' ? 'pending' : s.state === 'success' ? 'passing' : 'failing' });
  }
  return summarizeChecks(checks);
}

// CI on the newest commit may still be running, so fall back to the previous two commits.
async function collectCi(client, base, shas, ignoreChecks) {
  const ignored = new Set(ignoreChecks.filter(Boolean));
  const isIgnored = (name) => ignored.has(name) || DEFAULT_IGNORED.test(name);
  let fallback = null;
  for (const sha of shas.slice(0, 3)) {
    const result = await ciForSha(client, base, sha, isIgnored);
    if (!result) continue;
    if (result.state === 'passing' || result.state === 'failing') return { ...result, sha };
    if (!fallback || (fallback.state === 'unknown' && result.state === 'pending')) fallback = { ...result, sha };
  }
  return fallback ?? { state: 'unknown', total: 0, failing: 0, failingNames: [] };
}

async function collectIssues(client, base, now) {
  const items = await client.get(`${base}/issues`, {
    query: { state: 'open', per_page: 100, sort: 'created', direction: 'asc' },
  });
  const out = { open: 0, stale: 0, openPRs: 0, stalePRs: 0, unanswered: [] };
  for (const item of items ?? []) {
    const idle = ageInDays(item.updated_at, now);
    if (item.pull_request) {
      out.openPRs += 1;
      if (idle > STALE_DAYS) out.stalePRs += 1;
      continue;
    }
    out.open += 1;
    if (idle > STALE_DAYS) out.stale += 1;
    const age = ageInDays(item.created_at, now);
    const fromCommunity = !MAINTAINERS.has(item.author_association) && !isBot(item.user);
    if (item.comments === 0 && age > NUDGE_DAYS && fromCommunity) {
      out.unanswered.push({ number: item.number, days: Math.floor(age) });
    }
  }
  out.unanswered = out.unanswered.slice(0, 5);
  return out;
}

async function collectRelease(client, base) {
  try {
    const r = await client.get(`${base}/releases/latest`);
    return { tag: r.tag_name, name: r.name, publishedAt: r.published_at };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function collectContributors(client, base) {
  const res = await client.request('GET', `${base}/contributors`, { query: { per_page: 1, anon: 1 } });
  return { total: lastPageFromLink(res.headers.get('link')) ?? (Array.isArray(res.data) ? res.data.length : 0) };
}

async function collectTreats(client, base, now) {
  const pulls = await client.get(`${base}/pulls`, { query: { state: 'closed', sort: 'updated', direction: 'desc', per_page: 30 } });
  return (pulls ?? [])
    .filter((p) => p.merged_at && ageInDays(p.merged_at, now) <= TREAT_DAYS && !isBot(p.user))
    .map((p) => ({
      user: p.user.login,
      number: p.number,
      title: p.title,
      mergedAt: p.merged_at,
      external: !MAINTAINERS.has(p.author_association),
    }))
    .sort((a, b) => Number(b.external) - Number(a.external) || Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
}

// Reads everything the pet cares about. Only the repo itself is required:
// any other call that fails (missing permission, private data) becomes "unknown".
export async function collectSnapshot(client, { owner, repo, now = new Date(), ignoreChecks = [] }) {
  const base = `/repos/${owner}/${repo}`;
  const r = await client.get(base);
  const warnings = [];
  const optional = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      warnings.push(`Could not read ${label}: ${err.message}`);
      return fallback;
    }
  };

  const branch = r.default_branch;
  const [commits, issues, release, community, contributors, treats] = await Promise.all([
    optional('commits', () => collectCommits(client, base, branch, now), { total: null, lastDate: r.pushed_at, recent: [] }),
    optional('issues', () => collectIssues(client, base, now), null),
    optional('releases', () => collectRelease(client, base), null),
    optional('community profile', async () => ({ health: (await client.get(`${base}/community/profile`)).health_percentage }), null),
    optional('contributors', () => collectContributors(client, base), null),
    optional('pull requests', () => collectTreats(client, base, now), []),
  ]);
  const shas = [...new Set([commits.headSha, ...commits.recent.slice(0, 3).map((c) => c.sha)].filter(Boolean))];
  const ci = await optional('CI status', () => collectCi(client, base, shas, ignoreChecks), { state: 'unknown', total: 0, failing: 0, failingNames: [] });

  return {
    repo: {
      owner: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: branch,
      archived: r.archived,
      isPrivate: r.private,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
    },
    commits,
    ci,
    issues,
    release,
    community,
    contributors,
    treats,
    warnings,
    fetchedAt: now.toISOString(),
  };
}
