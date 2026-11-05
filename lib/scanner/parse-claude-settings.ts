import type { Finding, FindingSource } from "./types";
import { classifyCommand, classifyPermission } from "./rules";

interface HookEntry {
  type?: string;
  command?: string;
}

interface HookMatcher {
  matcher?: string;
  hooks?: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>;
  permissions?: { allow?: string[]; deny?: string[]; defaultMode?: string };
  statusLine?: { type?: string; command?: string };
  apiKeyHelper?: string;
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
}

export function parseClaudeSettings(source: FindingSource, raw: string): Finding[] {
  let settings: ClaudeSettings;
  try {
    settings = JSON.parse(raw);
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
  const addCommand = (context: string, command: string) => {
    const verdict = classifyCommand(command);
    findings.push({ source, context, command, severity: verdict.severity, reason: verdict.reason });
  };

  for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
    for (const matcher of matchers ?? []) {
      for (const hook of matcher.hooks ?? []) {
        if (hook.command) addCommand(event, hook.command);
      }
    }
  }

  if (settings.statusLine?.command) addCommand("statusLine", settings.statusLine.command);
  if (settings.apiKeyHelper) addCommand("apiKeyHelper", settings.apiKeyHelper);

  for (const perm of settings.permissions?.allow ?? []) {
    const verdict = classifyPermission(perm);
    if (verdict.severity !== "safe") {
      findings.push({ source, context: "permissions.allow", command: perm, ...verdict });
    }
  }

  if (settings.permissions?.defaultMode === "bypassPermissions") {
    findings.push({
      source,
      context: "permissions.defaultMode",
      command: "bypassPermissions",
      severity: "risky",
      reason: "Turns off every permission prompt — the agent runs all tools and commands without asking.",
    });
  }

  if (settings.enableAllProjectMcpServers) {
    findings.push({
      source,
      context: "enableAllProjectMcpServers",
      command: "true",
      severity: "suspicious",
      reason: "Auto-approves every MCP server in the repo's .mcp.json, skipping the trust prompt.",
    });
  }

  if (settings.enabledMcpjsonServers?.length) {
    findings.push({
      source,
      context: "enabledMcpjsonServers",
      command: settings.enabledMcpjsonServers.join(", "),
      severity: "suspicious",
      reason: "Pre-approves these .mcp.json servers so they start without a trust prompt.",
    });
  }

  return findings;
}
