import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Monospace document code with click-to-copy (barcodes, GRN, roll codes). */
export function CodeChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent"
    >
      {value}
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3 text-muted-foreground" />}
    </button>
  );
}
