import type { Severity } from "@/lib/scanner/types";

const STYLES: Record<Severity, { label: string; classes: string }> = {
  safe: { label: "Safe", classes: "bg-safe-bg text-safe-fg border-safe-border" },
  suspicious: { label: "Suspicious", classes: "bg-suspicious-bg text-suspicious-fg border-suspicious-border" },
  risky: { label: "Risky", classes: "bg-risky-bg text-risky-fg border-risky-border" },
};

export function VerdictBadge({ severity, size = "md" }: { severity: Severity; size?: "sm" | "md" }) {
  const style = STYLES[severity];
  const sizeClasses = size === "md" ? "text-lg px-4 py-1.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${style.classes}`}>
      {style.label}
    </span>
  );
}
