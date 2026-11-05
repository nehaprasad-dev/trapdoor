import { fetchFileContent, listDirectory } from "../github";
import type { Finding, RepoRef, ScannedFile, ScanResult } from "./types";
import { parseClaudeSettings } from "./parse-claude-settings";
import { parseMcpConfig } from "./parse-mcp";
import { parseAgentDoc } from "./parse-agent-docs";
import { classifyCommand, overallVerdict } from "./rules";

const KNOWN_PATHS: Array<{ path: string; kind: "claude-settings" | "mcp" | "doc" }> = [
  { path: ".claude/settings.json", kind: "claude-settings" },
  { path: ".claude/settings.local.json", kind: "claude-settings" },
  { path: ".cursor/mcp.json", kind: "mcp" },
  { path: ".mcp.json", kind: "mcp" },
  { path: ".vscode/mcp.json", kind: "mcp" },
  { path: "AGENTS.md", kind: "doc" },
  { path: "CLAUDE.md", kind: "doc" },
];

async function scanInRepoScript(
  ref: RepoRef,
  sha: string,
  source: Finding["source"],
  invocation: string,
): Promise<Finding[]> {
  const match = invocation.match(/(?:bash|sh)\s+(\.\/[^\s]+|[\w./-]+\.sh)|(\.\/[\w./-]+)/);
  const scriptPath = (match?.[1] ?? match?.[2])?.replace(/^\.\//, "");
  if (!scriptPath) return [];
  const content = await fetchFileContent(ref, scriptPath, sha);
  if (!content) return [];

  const findings: Finding[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const verdict = classifyCommand(trimmed);
    if (verdict.severity !== "safe") {
      findings.push({
        source,
        context: `inside ${scriptPath}`,
        command: trimmed,
        severity: verdict.severity,
        reason: verdict.reason,
      });
    }
  }
  return findings;
}

export async function scanRepo(ref: RepoRef, commitSha: string): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const findings: Finding[] = [];

  for (const { path, kind } of KNOWN_PATHS) {
    const content = await fetchFileContent(ref, path, commitSha);
    files.push({ path, present: content !== null });
    if (!content) continue;

    const source = path as Finding["source"];
    let fileFindings: Finding[] = [];
    if (kind === "claude-settings") {
      fileFindings = parseClaudeSettings(source, content);
    } else if (kind === "mcp") {
      fileFindings = parseMcpConfig(source, content);
    } else {
      fileFindings = parseAgentDoc(source, content);
    }
    findings.push(...fileFindings);

    if (kind === "claude-settings") {
      for (const f of fileFindings) {
        if (f.context === "permissions.allow" || f.context === "parse error") continue;
        findings.push(...(await scanInRepoScript(ref, commitSha, source, f.command)));
      }
    }
  }

  const cursorRulesDir = ".cursor/rules";
  const ruleFiles = await listDirectory(ref, cursorRulesDir, commitSha);
  const hasRules = ruleFiles.length > 0;
  files.push({ path: cursorRulesDir, present: hasRules });
  for (const rulePath of ruleFiles) {
    const content = await fetchFileContent(ref, rulePath, commitSha);
    if (content) findings.push(...parseAgentDoc(".cursor/rules", content));
  }

  return {
    owner: ref.owner,
    repo: ref.repo,
    commitSha,
    scannedAt: new Date().toISOString(),
    files,
    findings,
    verdict: overallVerdict(findings.map((f) => f.severity)),
    fromCache: false,
  };
}
