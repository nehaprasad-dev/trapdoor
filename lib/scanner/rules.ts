import type { Severity } from "./types";

const PIPE_TO_SHELL = /\b(curl|wget)\b[^|&;]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i;
const BASE64_EXEC = /base64\s+(-d|--decode)[^|&;]*\|\s*(sh|bash|zsh)\b/i;
const EVAL_CURL = /\beval\s*\(?\s*\$?\(?\s*(curl|wget)\b/i;
const UNRESTRICTED_BASH = /^Bash\(\*\)$/i;
const REMOTE_SCRIPT_FETCH = /\b(curl|wget)\b.*https?:\/\//i;

const SAFE_COMMAND_PREFIXES = [
  "npm ",
  "npx ",
  "pnpm ",
  "yarn ",
  "eslint",
  "prettier",
  "git ",
  "make",
  "pytest",
  "python -m pytest",
  "tsc",
  "jest",
  "vitest",
];

const TRUSTED_DOMAINS = [
  "github.com",
  "raw.githubusercontent.com",
  "registry.npmjs.org",
  "pypi.org",
  "files.pythonhosted.org",
];

export interface RuleVerdict {
  severity: Severity;
  reason: string;
}

function hostFromUrl(text: string): string[] {
  const matches = text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g);
  return [...matches].map((m) => m[1].toLowerCase());
}

/** Classifies a single extracted command/permission string found in an AI-agent config. */
export function classifyCommand(command: string): RuleVerdict {
  const trimmed = command.trim();

  if (UNRESTRICTED_BASH.test(trimmed)) {
    return {
      severity: "risky",
      reason: "Grants the agent unrestricted shell access (Bash(*)) with no command allowlist.",
    };
  }

  if (PIPE_TO_SHELL.test(trimmed)) {
    return {
      severity: "risky",
      reason: "Downloads a remote script and pipes it directly into a shell — classic curl|bash pattern.",
    };
  }

  if (BASE64_EXEC.test(trimmed) || EVAL_CURL.test(trimmed)) {
    return {
      severity: "risky",
      reason: "Obfuscated execution (base64-decoded or eval'd remote payload) — designed to resist casual review.",
    };
  }

  if (REMOTE_SCRIPT_FETCH.test(trimmed)) {
    const hosts = hostFromUrl(trimmed);
    const untrusted = hosts.filter((h) => !TRUSTED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`)));
    if (untrusted.length > 0) {
      return {
        severity: "suspicious",
        reason: `Fetches content from an unfamiliar host (${untrusted.join(", ")}) rather than a known package registry.`,
      };
    }
    return {
      severity: "safe",
      reason: "Fetches from a recognized, trusted host.",
    };
  }

  const isKnownSafe = SAFE_COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (isKnownSafe) {
    return { severity: "safe", reason: "Standard local dev tooling command." };
  }

  if (trimmed.startsWith("bash ") || trimmed.startsWith("sh ") || trimmed.startsWith("./")) {
    return {
      severity: "suspicious",
      reason: "Invokes an in-repo script — contents should be reviewed directly.",
    };
  }

  return {
    severity: "suspicious",
    reason: "Unrecognized command pattern — not a known-safe dev tool and not clearly malicious.",
  };
}

export function overallVerdict(severities: Severity[]): Severity {
  if (severities.includes("risky")) return "risky";
  if (severities.includes("suspicious")) return "suspicious";
  return "safe";
}
