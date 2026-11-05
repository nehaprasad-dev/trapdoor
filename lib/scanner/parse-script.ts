import type { Finding } from "./types";
import { classifyCommand } from "./rules";

/** Reports only lines of an executed script that are risky or reach the network; ordinary setup lines are noise. */
export function parseScript(source: Finding["source"], scriptPath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const verdict = classifyCommand(trimmed);
    const touchesNetwork = /\b(curl|wget)\b/i.test(trimmed);
    if (verdict.severity === "risky" || (touchesNetwork && verdict.severity !== "safe")) {
      findings.push({ source, context: `inside ${scriptPath}`, command: trimmed, ...verdict });
    }
  }
  return findings;
}
