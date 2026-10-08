// The pet lives on its own branch (default: `legacypet`). Each run replaces the
// branch with a single fresh commit, so it never grows a long history.

const BRANCH_NAME = /^[\w.\-/]+$/;

function assertBranch(branch) {
  if (!BRANCH_NAME.test(branch) || branch.includes('..')) throw new Error(`Invalid branch name "${branch}"`);
}

export async function loadPrevious(client, { owner, repo, branch }) {
  assertBranch(branch);
  const read = async (path) => {
    try {
      const file = await client.get(`/repos/${owner}/${repo}/contents/${path}`, { query: { ref: branch } });
      return Buffer.from(file.content ?? '', file.encoding ?? 'base64').toString('utf8');
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  };
  const [json, diary] = await Promise.all([read('pet.json'), read('DIARY.md')]);
  let state = null;
  try {
    state = json ? JSON.parse(json) : null;
  } catch {
    state = null;
  }
  return { state, diary };
}

export async function publishFiles(client, { owner, repo, branch, files, message }) {
  assertBranch(branch);
  const base = `/repos/${owner}/${repo}`;
  let current = null;
  try {
    current = await client.get(`${base}/git/ref/heads/${branch}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const tree = await client.post(`${base}/git/trees`, {
    tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
  });

  if (current) {
    const head = await client.get(`${base}/git/commits/${current.object.sha}`);
    if (head.tree.sha === tree.sha) return { changed: false, sha: current.object.sha };
  }

  const commit = await client.post(`${base}/git/commits`, { message, tree: tree.sha, parents: [] });
  if (current) await client.patch(`${base}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
  else await client.post(`${base}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  return { changed: true, created: !current, sha: commit.sha };
}
