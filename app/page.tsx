"use client";

import { useState } from "react";
import type { ScanResult } from "@/lib/scanner/types";
import { ScanReport } from "@/components/ScanReport";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleSubmit(e: React.FormEvent, force = false) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data as ScanResult);
    } catch {
      setError("Could not reach the scanner. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-20 gap-10">
      <div className="text-center max-w-xl flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">Trapdoor</h1>
        <p className="text-muted">
          Paste a GitHub repo URL and see exactly what it will auto-run the moment you open it in Claude Code, Cursor,
          or Codex — before you clone it.
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e)} className="w-full max-w-xl flex gap-2">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="github.com/owner/repo"
          className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent hover:bg-accent-hover text-accent-fg disabled:opacity-50 px-5 py-3 text-sm font-medium transition-colors"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-error-fg border border-error-border bg-error-bg rounded-lg px-4 py-3 max-w-xl w-full">
          {error}
        </p>
      )}

      {result && (
        <>
          <ScanReport result={result} />
          {result.fromCache && (
            <button
              onClick={(e) => handleSubmit(e, true)}
              className="text-xs text-subtle hover:text-foreground underline"
            >
              Re-scan latest commit
            </button>
          )}
        </>
      )}
    </main>
  );
}
