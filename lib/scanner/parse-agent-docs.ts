import type { Finding, FindingSource } from "./types";
import { classifyCommand } from "./rules";

const CODE_BLOCK = /```(?:bash|sh|shell|zsh|console)\n([\s\S]*?)```/g;

export function parseAgentDoc(source: FindingSource, raw: string): Finding[] {
  const findings: Finding[] = [];

  for (const match of raw.matchAll(CODE_BLOCK)) {
    const block = match[1];
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const verdict = classifyCommand(trimmed);
      const touchesNetwork = /\b(curl|wget)\b/i.test(trimmed);
      if (verdict.severity === "risky" || (touchesNetwork && verdict.severity !== "safe")) {
        findings.push({
          source,
          context: "shell code block",
          command: trimmed,
          severity: verdict.severity === "risky" ? "suspicious" : verdict.severity,
          reason: `${verdict.reason} (found in documentation — the agent must choose to run this, it does not auto-execute).`,
        });
      }
    }
  }

  return findings;
}
