import { NextRequest, NextResponse } from "next/server";
import { GitHubError, getDefaultBranchCommitSha, parseRepoUrl } from "@/lib/github";
import { scanRepo } from "@/lib/scanner/scan";
import { getCachedScan, putCachedScan } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { repoUrl?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "repoUrl is required." }, { status: 400 });
  }

  try {
    const ref = parseRepoUrl(body.repoUrl);
    const commitSha = await getDefaultBranchCommitSha(ref);

    if (!body.force) {
      const cached = await getCachedScan(ref.owner, ref.repo, commitSha);
      if (cached) {
        return NextResponse.json({ ...cached, fromCache: true });
      }
    }

    const result = await scanRepo(ref, commitSha);
    await putCachedScan(result);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error while scanning the repo." }, { status: 500 });
  }
}
