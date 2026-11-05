import type { ScanResult } from "@/lib/scanner/types";
import { VerdictBadge } from "./VerdictBadge";

export function ScanReport({ result }: { result: ScanResult }) {
  const presentFiles = result.files.filter((f) => f.present);
  const hasFindings = result.findings.length > 0;

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="min-w-0">
          <p className="font-medium text-foreground break-all">
            {result.owner}/{result.repo}
          </p>
          <p className="text-xs text-subtle mt-1">
            commit {result.commitSha.slice(0, 7)} · scanned {new Date(result.scannedAt).toLocaleString()}
            {result.fromCache ? " · cached" : ""}
          </p>
        </div>
        <VerdictBadge severity={result.verdict} />
      </div>

      {presentFiles.length === 0 ? (
        <p className="text-muted text-sm">
          No AI-agent config files found (.claude/settings.json, .cursor/mcp.json, AGENTS.md, CLAUDE.md). Nothing will
          auto-run when this repo is opened in an agent.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Files found</h2>
          <ul className="flex flex-wrap gap-2">
            {presentFiles.map((f) => (
              <li key={f.path} className="text-xs rounded-md bg-code-bg border border-border px-2 py-1 font-mono">
                {f.path}
              </li>
            ))}
          </ul>
          {!hasFindings && (
            <p className="text-muted text-sm">These files contain nothing that runs automatically or looks risky.</p>
          )}
        </div>
      )}

      {hasFindings && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">What it will do</h2>
          {result.findings.map((finding, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-subtle break-all">
                  {finding.source} · {finding.context}
                </span>
                <VerdictBadge severity={finding.severity} size="sm" />
              </div>
              <code className="text-sm bg-code-bg rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                {finding.command}
              </code>
              <p className="text-xs text-muted">{finding.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
