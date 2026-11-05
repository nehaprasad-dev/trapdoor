export type Severity = "safe" | "suspicious" | "risky";

export type FindingSource =
  | ".claude/settings.json"
  | ".claude/settings.local.json"
  | ".cursor/environment.json"
  | ".cursor/mcp.json"
  | ".cursor/rules"
  | "AGENTS.md"
  | "CLAUDE.md"
  | ".mcp.json"
  | ".vscode/mcp.json";

export interface Finding {
  source: FindingSource;
  /** e.g. "PreToolUse", "SessionStart", mcp server name, or "shell block" */
  context: string;
  command: string;
  severity: Severity;
  reason: string;
}

export interface ScannedFile {
  path: string;
  present: boolean;
}

export interface ScanResult {
  owner: string;
  repo: string;
  commitSha: string;
  scannedAt: string;
  files: ScannedFile[];
  findings: Finding[];
  verdict: Severity;
  fromCache: boolean;
}

export interface RepoRef {
  owner: string;
  repo: string;
}
