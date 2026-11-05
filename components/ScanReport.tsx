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

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          Checked {result.files.length} locations · {presentFiles.length} found
        </h2>
        <ul className="rounded-lg border border-border divide-y divide-border">
          {result.files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className={`font-mono break-all ${f.present ? "text-foreground" : "text-subtle"}`}>{f.path}</span>
              <span className={`text-xs shrink-0 ${f.present ? "text-foreground" : "text-subtle"}`}>
                {f.present ? "found" : "not present"}
              </span>
            </li>
          ))}
        </ul>
        {!hasFindings && (
          <p className="text-muted text-sm">
            {presentFiles.length === 0
              ? "This repo has no AI-agent config, so nothing runs automatically when you open it in an agent."
              : "The config files found contain nothing that runs automatically or looks risky."}
          </p>
        )}
      </div>

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
