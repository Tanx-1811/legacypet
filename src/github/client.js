// A minimal GitHub REST client on top of global fetch (Node 20+). No dependencies.

export class GitHubError extends Error {
  constructor(status, message, route) {
    super(`${route} → ${status} ${message}`);
    this.status = status;
    this.route = route;
  }
}

export function createClient({ token, baseUrl = 'https://api.github.com', fetch: fetchImpl = globalThis.fetch } = {}) {
  async function request(method, path, { query, body } = {}) {
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const headers = { accept: 'application/vnd.github+json' };
    // Browsers set their own User-Agent (and the playground runs in one).
    if (globalThis.process?.versions?.node) headers['user-agent'] = 'legacypet';
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    const res = await fetchImpl(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) throw new GitHubError(res.status, data?.message ?? res.statusText, `${method} ${url.pathname}`);
    return { status: res.status, data, headers: res.headers };
  }

  return {
    request,
    get: async (path, opts) => (await request('GET', path, opts)).data,
    post: async (path, body) => (await request('POST', path, { body })).data,
    patch: async (path, body) => (await request('PATCH', path, { body })).data,
    put: async (path, body) => (await request('PUT', path, { body })).data,
  };
}

// GitHub tells us how many pages exist in the Link header; with per_page=1 that's the item count.
export function lastPageFromLink(link) {
  const match = /[?&]page=(\d+)>;\s*rel="last"/.exec(link ?? '');
  return match ? Number(match[1]) : null;
}
