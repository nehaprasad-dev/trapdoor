import type { RepoRef } from "./scanner/types";

const GITHUB_API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function parseRepoUrl(input: string): RepoRef {
  const trimmed = input.trim();
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (!match) {
    throw new GitHubError("That doesn't look like a GitHub repo URL (expected github.com/owner/repo).", 400);
  }
  return { owner: match[1], repo: match[2] };
}

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function ghFetch(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GitHubError("GitHub API rate limit hit. Try again shortly, or supply a GITHUB_TOKEN.", 429);
    }
    throw new GitHubError("Access denied — the repo may be private.", 403);
  }
  return res;
}

export async function getDefaultBranchCommitSha(ref: RepoRef): Promise<string> {
  const res = await ghFetch(`/repos/${ref.owner}/${ref.repo}`);
  if (res.status === 404) {
    throw new GitHubError("Repo not found. Check the URL and that it's public.", 404);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error (${res.status})`, res.status);
  }
  const data = (await res.json()) as { default_branch: string };
  const branchRes = await ghFetch(`/repos/${ref.owner}/${ref.repo}/branches/${data.default_branch}`);
  if (!branchRes.ok) {
    throw new GitHubError(`Could not resolve default branch commit (${branchRes.status})`, branchRes.status);
  }
  const branchData = (await branchRes.json()) as { commit: { sha: string } };
  return branchData.commit.sha;
}

/** Fetches a single file's raw text content, or null if it doesn't exist. */
export async function fetchFileContent(ref: RepoRef, path: string, sha: string): Promise<string | null> {
  const res = await ghFetch(`/repos/${ref.owner}/${ref.repo}/contents/${path}?ref=${sha}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(`Failed to fetch ${path} (${res.status})`, res.status);
  const data = (await res.json()) as { content?: string; encoding?: string; type?: string };
  if (data.type !== "file" || !data.content) return null;
  return Buffer.from(data.content, (data.encoding as BufferEncoding) ?? "base64").toString("utf-8");
}

/** Lists files in a directory, or returns [] if it doesn't exist. */
export async function listDirectory(ref: RepoRef, path: string, sha: string): Promise<string[]> {
  const res = await ghFetch(`/repos/${ref.owner}/${ref.repo}/contents/${path}?ref=${sha}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubError(`Failed to list ${path} (${res.status})`, res.status);
  const data = (await res.json()) as Array<{ path: string; type: string }>;
  if (!Array.isArray(data)) return [];
  return data.filter((entry) => entry.type === "file").map((entry) => entry.path);
}
