export type PullRequestData = {
  number: number;
  body: string;
  headSha: string;
  baseSha: string;
};

export function pullRequestFromApi(payload: unknown): PullRequestData {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("pull request payload was not an object");
  }
  const record = payload as Record<string, unknown>;
  const head = record.head;
  const base = record.base;
  const headSha =
    typeof head === "object" && head !== null && typeof (head as { sha?: unknown }).sha === "string"
      ? (head as { sha: string }).sha
      : "";
  const baseSha =
    typeof base === "object" && base !== null && typeof (base as { sha?: unknown }).sha === "string"
      ? (base as { sha: string }).sha
      : "";
  const body = typeof record.body === "string" ? record.body : "";
  if (typeof record.number !== "number" || headSha.length === 0 || baseSha.length === 0) {
    throw new Error("pull request payload is missing number or SHAs");
  }
  return { number: record.number, body, headSha, baseSha };
}

export function commentsFromApi(payload: unknown): { body: string }[] {
  if (!Array.isArray(payload)) {
    throw new Error("issue comments payload was not an array");
  }
  return payload
    .filter((item): item is { body: string } => {
      return typeof item === "object" && item !== null && typeof (item as { body?: unknown }).body === "string";
    })
    .map((item) => ({ body: item.body }));
}

function githubHeaders(token: string, accept: string): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "grok-bot-cursor-review",
  };
}

export function assertRepoSlug(repo: string): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("GITHUB_REPOSITORY is not an owner/name slug");
  }
}

export async function fetchIssueComments(input: {
  apiBase: string;
  repo: string;
  issue: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<{ body: string }[]> {
  assertRepoSlug(input.repo);
  const fetchImpl = input.fetchImpl ?? fetch;
  const comments: { body: string }[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${input.apiBase}/repos/${input.repo}/issues/${input.issue}/comments?per_page=100&page=${page}`;
    const response = await fetchImpl(url, { headers: githubHeaders(input.token, "application/vnd.github+json") });
    if (!response.ok) {
      throw new Error(`GitHub issue comments failed with HTTP ${response.status}`);
    }
    const batch = (await response.json()) as unknown;
    const pageComments = commentsFromApi(batch);
    comments.push(...pageComments);
    if (!Array.isArray(batch) || batch.length < 100) {
      break;
    }
  }
  return comments;
}

export async function fetchPullRequest(input: {
  apiBase: string;
  repo: string;
  number: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<PullRequestData> {
  assertRepoSlug(input.repo);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.apiBase}/repos/${input.repo}/pulls/${input.number}`, {
    headers: githubHeaders(input.token, "application/vnd.github+json"),
  });
  if (!response.ok) {
    throw new Error(`GitHub pull request read failed with HTTP ${response.status}`);
  }
  return pullRequestFromApi((await response.json()) as unknown);
}

export async function postCommitStatus(input: {
  apiBase: string;
  repo: string;
  sha: string;
  token: string;
  body: { state: string; target_url: string; description: string; context: string };
  fetchImpl?: typeof fetch;
}): Promise<void> {
  assertRepoSlug(input.repo);
  if (!/^[0-9a-f]{40}$/.test(input.sha)) {
    throw new Error("refusing to set a commit status on a non-SHA ref");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.apiBase}/repos/${input.repo}/statuses/${input.sha}`, {
    method: "POST",
    headers: {
      ...githubHeaders(input.token, "application/vnd.github+json"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  if (!response.ok) {
    throw new Error(`GitHub commit status failed with HTTP ${response.status}`);
  }
}
