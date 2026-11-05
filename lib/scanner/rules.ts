import type { Severity } from "./types";

const PIPE_TO_SHELL = /\b(curl|wget)\b[^|&;]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i;
const BASE64_EXEC = /base64\s+(-d|--decode)[^|&;]*\|\s*(sh|bash|zsh)\b/i;
const EVAL_CURL = /\beval\s*\(?\s*\$?\(?\s*(curl|wget)\b/i;
const REMOTE_SCRIPT_FETCH = /\b(curl|wget)\b.*https?:\/\//i;
const CHAIN_SEPARATOR = /&&|\|\||;|\|/;

const SAFE_COMMANDS = new Set([
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "eslint",
  "prettier",
  "git",
  "make",
  "pytest",
  "tsc",
  "jest",
  "vitest",
  "cargo",
  "go",
]);

const TRUSTED_DOMAINS = [
  "github.com",
  "raw.githubusercontent.com",
  "registry.npmjs.org",
  "pypi.org",
  "files.pythonhosted.org",
];

const TRUSTED_PACKAGE_SCOPES = ["@modelcontextprotocol/"];

const SEVERITY_RANK: Record<Severity, number> = { safe: 0, suspicious: 1, risky: 2 };

export interface RuleVerdict {
  severity: Severity;
  reason: string;
}

function hostsIn(text: string): string[] {
  return [...text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((m) => m[1].toLowerCase());
}

function isTrustedHost(host: string): boolean {
  return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Returns the package a runner like `npx -y pkg` or `uvx pkg` downloads and executes, if any. */
function packageRunnerTarget(tokens: string[]): string | null {
  const [first, second] = tokens;
  let rest: string[];
  if (first === "uvx" || first === "bunx") {
    rest = tokens.slice(1);
  } else if ((first === "pnpm" || first === "yarn") && second === "dlx") {
    rest = tokens.slice(2);
  } else if (first === "npx" && tokens.some((t) => t === "-y" || t === "--yes")) {
    rest = tokens.slice(1);
  } else {
    return null;
  }
  return rest.find((t) => !t.startsWith("-")) ?? null;
}

function classifySegment(segment: string): RuleVerdict {
  if (REMOTE_SCRIPT_FETCH.test(segment)) {
    const untrusted = hostsIn(segment).filter((h) => !isTrustedHost(h));
    if (untrusted.length > 0) {
      return {
        severity: "suspicious",
        reason: `Fetches content from an unfamiliar host (${untrusted.join(", ")}) rather than a known package registry.`,
      };
    }
    return { severity: "safe", reason: "Fetches from a recognized, trusted host." };
  }

  const tokens = segment.split(/\s+/);
  const pkg = packageRunnerTarget(tokens);
  if (pkg) {
    if (TRUSTED_PACKAGE_SCOPES.some((scope) => pkg.startsWith(scope))) {
      return { severity: "safe", reason: `Runs ${pkg}, an official package.` };
    }
    return {
      severity: "suspicious",
      reason: `Downloads and runs the package "${pkg}" from the registry on every launch — whatever its latest version contains.`,
    };
  }

  if (SAFE_COMMANDS.has(tokens[0])) {
    return { severity: "safe", reason: "Standard local dev tooling command." };
  }

  if (tokens[0] === "bash" || tokens[0] === "sh" || tokens[0].startsWith("./")) {
    return { severity: "suspicious", reason: "Invokes an in-repo script — contents should be reviewed directly." };
  }

  return {
    severity: "suspicious",
    reason: "Unrecognized command pattern — not a known-safe dev tool and not clearly malicious.",
  };
}

/** Classifies a single extracted command string found in an AI-agent config. */
export function classifyCommand(command: string): RuleVerdict {
  const trimmed = command.trim();

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

  const segments = trimmed
    .split(CHAIN_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);

  let worst: RuleVerdict = { severity: "safe", reason: "Standard local dev tooling command." };
  for (const segment of segments) {
    const verdict = classifySegment(segment);
    if (SEVERITY_RANK[verdict.severity] > SEVERITY_RANK[worst.severity]) worst = verdict;
  }
  return worst;
}

/** Classifies a Claude Code `permissions.allow` entry; only non-safe entries are worth reporting. */
export function classifyPermission(entry: string): RuleVerdict {
  const trimmed = entry.trim();
  if (/^Bash(\((\*|:\*)?\))?$/i.test(trimmed)) {
    return {
      severity: "risky",
      reason: "Pre-approves every shell command — the agent can run anything without asking.",
    };
  }

  const inner = trimmed.match(/^Bash\((.*)\)$/i)?.[1];
  if (inner === undefined) {
    return { severity: "safe", reason: "Not a shell permission." };
  }

  const base = inner.replace(/:\*$/, "").trim();
  if (/^(curl|wget|sh|bash|zsh|eval|sudo)\b/.test(base) || /^(python3?|node)\s+-(c|e)\b/.test(base)) {
    return {
      severity: "suspicious",
      reason: `Pre-approves "${base}" with any arguments — enough to download or run arbitrary code without a prompt.`,
    };
  }

  return { severity: "safe", reason: "Scoped permission for a specific command." };
}

export function overallVerdict(severities: Severity[]): Severity {
  if (severities.includes("risky")) return "risky";
  if (severities.includes("suspicious")) return "suspicious";
  return "safe";
}
