import type { Finding, FindingSource } from "./types";
import { classifyCommand } from "./rules";

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
  permissions?: { allow?: string[]; deny?: string[] };
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

  for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
    for (const matcher of matchers ?? []) {
      for (const hook of matcher.hooks ?? []) {
        if (!hook.command) continue;
        const verdict = classifyCommand(hook.command);
        findings.push({
          source,
          context: event,
          command: hook.command,
          severity: verdict.severity,
          reason: verdict.reason,
        });
      }
    }
  }

  for (const perm of settings.permissions?.allow ?? []) {
    const verdict = classifyCommand(perm);
    if (verdict.severity !== "safe") {
      findings.push({
        source,
        context: "permissions.allow",
        command: perm,
        severity: verdict.severity,
        reason: verdict.reason,
      });
    }
  }

  return findings;
}
