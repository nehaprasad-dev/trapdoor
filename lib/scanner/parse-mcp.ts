import type { Finding, FindingSource } from "./types";
import { classifyCommand } from "./rules";

interface McpServer {
  command?: string;
  args?: string[];
  url?: string;
}

interface McpConfig {
  mcpServers?: Record<string, McpServer>;
}

export function parseMcpConfig(source: FindingSource, raw: string): Finding[] {
  let config: McpConfig;
  try {
    config = JSON.parse(raw);
  } catch {
    return [
      {
        source,
        context: "parse error",
        command: raw.slice(0, 200),
        severity: "suspicious",
        reason: "File could not be parsed as JSON — may be malformed or intentionally obfuscated.",
      },
    ];
  }

  const findings: Finding[] = [];

  for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
    if (server.command) {
      const full = [server.command, ...(server.args ?? [])].join(" ");
      const verdict = classifyCommand(full);
      findings.push({
        source,
        context: `mcp server: ${name}`,
        command: full,
        severity: verdict.severity,
        reason: verdict.reason,
      });
    } else if (server.url) {
      findings.push({
        source,
        context: `mcp server: ${name}`,
        command: server.url,
        severity: "suspicious",
        reason: "Connects to a remote MCP server — review the endpoint before trusting it.",
      });
    }
  }

  return findings;
}
