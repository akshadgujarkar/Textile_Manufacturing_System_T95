import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, CheckCircle2, AlertOctagon, RotateCcw, Plus, Trash2, ShieldCheck, Tag } from "lucide-react";
import { rolls, defectTypes, type Roll } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "Roll QC Inspection Station · Everest Textile Mills";
const description = "Tablet/mobile station for inspecting fabric rolls, tagging defects with severity, and assigning pass/rework/reject status.";

export const Route = createFileRoute("/app/quality/inspect")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: RollQCInspectPage,
});

interface TaggedDefect {
  id: string;
  typeId: string;
  label: string;
  severity: "Minor" | "Major" | "Critical";
  count: number;
  position: string;
}

function RollQCInspectPage() {
  const [scanCode, setScanCode] = useState("R-26-000482");
  const [activeRoll, setActiveRoll] = useState<Roll | null>(rolls[0]);
  const [taggedDefects, setTaggedDefects] = useState<TaggedDefect[]>([]);
  const [selectedDefectType, setSelectedDefectType] = useState<string | null>(null);

  const [severity, setSeverity] = useState<"Minor" | "Major" | "Critical">("Minor");
  const [defectCount, setDefectCount] = useState(1);
  const [position, setPosition] = useState("At 45m mark");

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const found = rolls.find((r) => r.code.toLowerCase() === scanCode.toLowerCase().trim());
    if (found) {
      setActiveRoll(found);
      setTaggedDefects([]);
      toast.success(`Scanned Roll ${found.code}`);
    } else {
      toast.error(`Roll code ${scanCode} not found in warehouse inventory.`);
    }
  };

  const addDefect = () => {
    if (!selectedDefectType) return;
    const def = defectTypes.find((d) => d.id === selectedDefectType);
    if (!def) return;

    const newDef: TaggedDefect = {
      id: `def-${Date.now()}`,
      typeId: def.id,
      label: def.label,
      severity,
      count: defectCount,
      position,
    };

    setTaggedDefects([...taggedDefects, newDef]);
    setSelectedDefectType(null);
    toast.info(`Tagged defect: ${def.label} (${severity})`);
  };

  const removeDefect = (id: string) => {
    setTaggedDefects((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDecision = (result: "in_stock" | "rework" | "rejected") => {
    if (!activeRoll) return;
    if (result === "in_stock") {
      toast.success(`Roll ${activeRoll.code} PASSED QC and assigned to Shelf B-14.`);
    } else if (result === "rework") {
      toast.warning(`Roll ${activeRoll.code} sent for REWORK processing.`);
    } else {
      toast.error(`Roll ${activeRoll.code} REJECTED and barred from dispatch.`);
    }
    setActiveRoll(null);
    setTaggedDefects([]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        breadcrumb={["App", "Quality", "Roll QC Station"]}
        title="Roll Quality Control Inspection Station"
        description="Scan fabric roll QR codes, log multi-defect incidents with severity, and update inventory shelf status."
      />

      {/* Barcode / QR Scanner Input */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Scan Roll Barcode / QR Code
        </label>
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Scan roll code (e.g. R-26-000482)..."
              className="h-11 w-full rounded-xl border bg-background pl-11 pr-4 text-base font-mono font-medium outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="px-5 rounded-xl bg-primary font-bold text-sm text-primary-foreground hover:bg-primary/90"
          >
            Fetch Roll
          </button>
        </form>
      </div>

      {activeRoll ? (
        <div className="space-y-6">
          {/* Scanned Roll Header Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold font-mono">{activeRoll.code}</h2>
                  <StatusBadge label={activeRoll.status.toUpperCase()} tone="info" />
                  <span className="text-xs px-2 py-0.5 rounded bg-muted font-semibold">Attempt #{activeRoll.attempt}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Machine: <strong className="font-mono">{activeRoll.machine}</strong> | Job: <strong className="font-mono">{activeRoll.job}</strong> | Buyer: <strong>{activeRoll.buyer}</strong>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Length & Weight</p>
                <p className="text-lg font-bold font-mono text-primary">{qty(activeRoll.length, "m")} · {qty(activeRoll.weight, "kg")}</p>
              </div>
            </div>

            {/* Defect Catalog Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Defect Catalog (Tap to Tag)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {defectTypes.map((dt) => (
                  <button
                    key={dt.id}
                    type="button"
                    onClick={() => setSelectedDefectType(dt.id)}
                    className={`p-3 rounded-xl border text-left font-semibold text-sm flex items-center justify-between transition-all ${
                      selectedDefectType === dt.id
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    <span>{dt.label}</span>
                    <Plus className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Defect Configuration Drawer / Box */}
            {selectedDefectType && (
              <div className="rounded-xl border bg-muted/40 p-4 space-y-4 animate-in fade-in">
                <h4 className="text-xs font-bold uppercase text-primary">
                  Configure Defect: {defectTypes.find((d) => d.id === selectedDefectType)?.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Severity Rating</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="h-9 w-full rounded border bg-background px-2 text-sm outline-none"
                    >
                      <option value="Minor">Minor</option>
                      <option value="Major">Major</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Defect Incident Count</label>
                    <input
                      type="number"
                      min="1"
                      value={defectCount}
                      onChange={(e) => setDefectCount(Number(e.target.value))}
                      className="h-9 w-full rounded border bg-background px-2 text-sm font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Position / Remarks</label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="h-9 w-full rounded border bg-background px-2 text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDefectType(null)}
                    className="px-3 py-1.5 rounded border text-xs font-medium hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addDefect}
                    className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold"
                  >
                    Add Defect Tag
                  </button>
                </div>
              </div>
            )}

            {/* Tagged Defects List */}
            {taggedDefects.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Tagged Defects in this Session</h4>
                <div className="divide-y rounded-xl border bg-background">
                  {taggedDefects.map((d) => (
                    <div key={d.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-bold">{d.label}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded font-bold ${
                          d.severity === "Critical" ? "bg-rose-100 text-rose-800" : d.severity === "Major" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {d.severity}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">Count: {d.count} ({d.position})</span>
                      </div>
                      <button
                        onClick={() => removeDefect(d.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Decision Control Bar */}
          <div className="sticky bottom-4 rounded-2xl border bg-card p-4 shadow-xl flex flex-wrap gap-3">
            <button
              onClick={() => handleDecision("in_stock")}
              className="flex-1 min-w-[140px] h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="size-5" /> PASS ROLL (To Shelf)
            </button>
            <button
              onClick={() => handleDecision("rework")}
              className="flex-1 min-w-[140px] h-12 rounded-xl bg-amber-600 text-white font-bold text-sm shadow hover:bg-amber-700 flex items-center justify-center gap-2"
            >
              <RotateCcw className="size-5" /> SEND FOR REWORK
            </button>
            <button
              onClick={() => handleDecision("rejected")}
              className="flex-1 min-w-[140px] h-12 rounded-xl bg-rose-600 text-white font-bold text-sm shadow hover:bg-rose-700 flex items-center justify-center gap-2"
            >
              <AlertOctagon className="size-5" /> REJECT ROLL (Scrap)
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Scan a fabric roll QR code above to begin QC inspection.
        </div>
      )}
    </div>
  );
}
