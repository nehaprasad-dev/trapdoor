import type { Finding } from "./types";
import { classifyCommand } from "./rules";

interface CursorEnvironment {
  install?: string;
  start?: string;
  terminals?: Array<{ name?: string; command?: string }>;
}

const SOURCE = ".cursor/environment.json";

/** Cursor background agents run `install`, `start` and each terminal command when they set up the repo. */
export function parseCursorEnvironment(raw: string): Finding[] {
  let env: CursorEnvironment;
  try {
    env = JSON.parse(raw);
  } catch {
    return [
      {
        source: SOURCE,
        context: "parse error",
        command: raw.slice(0, 200),
        severity: "suspicious",
        reason: "File could not be parsed as JSON — may be malformed or intentionally obfuscated.",
      },
    ];
  }

  const commands: Array<[string, string | undefined]> = [
    ["Cursor agent install", env.install],
    ["Cursor agent start", env.start],
    ...(env.terminals ?? []).map((t): [string, string | undefined] => [`Cursor agent terminal: ${t.name ?? "unnamed"}`, t.command]),
  ];

  return commands
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([context, command]) => ({ source: SOURCE, context, command, ...classifyCommand(command) }));
}
