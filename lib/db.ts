import { Pool } from "pg";
import type { ScanResult } from "./scanner/types";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

async function ensureSchema(p: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = p.query(`
      create table if not exists scans (
        owner text not null,
        repo text not null,
        commit_sha text not null,
        result jsonb not null,
        scanned_at timestamptz not null default now(),
        primary key (owner, repo, commit_sha)
      )
    `).then(() => undefined);
  }
  await schemaReady;
}

export async function getCachedScan(owner: string, repo: string, commitSha: string): Promise<ScanResult | null> {
  const p = getPool();
  if (!p) return null;
  await ensureSchema(p);
  const { rows } = await p.query<{ result: ScanResult }>(
    "select result from scans where owner = $1 and repo = $2 and commit_sha = $3",
    [owner, repo, commitSha],
  );
  return rows[0]?.result ?? null;
}

export async function putCachedScan(result: ScanResult): Promise<void> {
  const p = getPool();
  if (!p) return;
  await ensureSchema(p);
  await p.query(
    `insert into scans (owner, repo, commit_sha, result, scanned_at)
     values ($1, $2, $3, $4, $5)
     on conflict (owner, repo, commit_sha) do update set result = excluded.result, scanned_at = excluded.scanned_at`,
    [result.owner, result.repo, result.commitSha, JSON.stringify(result), result.scannedAt],
  );
}
