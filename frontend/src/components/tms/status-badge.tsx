import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "indigo" | "purple";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 [&>span]:bg-emerald-500 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 [&>span]:bg-amber-500 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 [&>span]:bg-rose-500 dark:bg-rose-950 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 [&>span]:bg-sky-500 dark:bg-sky-950 dark:text-sky-300",
  neutral: "bg-slate-100 text-slate-700 [&>span]:bg-slate-400 dark:bg-slate-800 dark:text-slate-300",
  indigo: "bg-indigo-50 text-indigo-700 [&>span]:bg-indigo-500 dark:bg-indigo-950 dark:text-indigo-300",
  purple: "bg-purple-50 text-purple-700 [&>span]:bg-purple-500 dark:bg-purple-950 dark:text-purple-300",
};

const statusTone: Record<string, { label: string; tone: Tone }> = {
  running: { label: "RUNNING", tone: "success" },
  idle: { label: "IDLE", tone: "neutral" },
  breakdown: { label: "BREAKDOWN", tone: "danger" },
  maintenance: { label: "MAINTENANCE", tone: "warning" },
  pending_qc: { label: "PENDING QC", tone: "info" },
  in_stock: { label: "IN STOCK", tone: "success" },
  rework: { label: "REWORK", tone: "warning" },
  rejected: { label: "REJECTED", tone: "danger" },
  loaded: { label: "LOADED", tone: "indigo" },
  dispatched: { label: "DISPATCHED", tone: "purple" },
  loading: { label: "LOADING", tone: "info" },
  paid: { label: "PAID", tone: "success" },
  partial: { label: "PARTIAL", tone: "warning" },
  unpaid: { label: "UNPAID", tone: "danger" },
  approved: { label: "APPROVED", tone: "success" },
  pending: { label: "PENDING", tone: "warning" },
  ok: { label: "OK", tone: "success" },
  matched: { label: "MATCHED", tone: "success" },
  variance: { label: "VARIANCE", tone: "warning" },
  awaiting_material: { label: "AWAITING MATERIAL", tone: "warning" },
  production_scheduled: { label: "SCHEDULED", tone: "info" },
  in_production: { label: "IN PRODUCTION", tone: "info" },
  in_qc: { label: "IN QC", tone: "indigo" },
  ready_for_dispatch: { label: "READY FOR DISPATCH", tone: "success" },
  partially_dispatched: { label: "PARTIALLY DISPATCHED", tone: "warning" },
  fully_dispatched: { label: "FULLY DISPATCHED", tone: "purple" },
};

export function StatusBadge({ status, label, tone, className }: { status?: string; label?: string; tone?: Tone; className?: string }) {
  const cfg = status ? statusTone[status] : undefined;
  const finalLabel = label ?? cfg?.label ?? (status ?? "").toUpperCase();
  const finalTone: Tone = tone ?? cfg?.tone ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tones[finalTone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full" aria-hidden />
      {finalLabel}
    </span>
  );
}
