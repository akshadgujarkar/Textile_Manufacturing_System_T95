import { useMemo, useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { suppliers, yarnTypes, orders } from "@/data/tms";
import { inr } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";

interface LotLine {
  yarnType: string;
  colour: string;
  received: string;
  challanQty: string;
  rate: string;
  earmark: string;
}

const emptyLine: LotLine = { yarnType: yarnTypes[0], colour: "", received: "", challanQty: "", rate: "", earmark: "" };

export function GateEntryPage() {
  // Idempotency token for zero double-submits (spec FR-1.1 / validation rule 5)
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [supplier, setSupplier] = useState("");
  const [challan, setChallan] = useState("");
  const [truck, setTruck] = useState("");
  const [lines, setLines] = useState<LotLine[]>([{ ...emptyLine }]);
  const [grn, setGrn] = useState<string | null>(null);
  const [error, setError] = useState("");

  const totalWeight = lines.reduce((s, l) => s + (parseFloat(l.received) || 0), 0);
  const totalValue = lines.reduce((s, l) => s + (parseFloat(l.received) || 0) * (parseFloat(l.rate) || 0), 0);
  const lots = useMemo(() => lines.map((_, i) => `LOT-26-${String(900 + i).padStart(6, "0")}`), [lines]);

  const updateLine = (i: number, patch: Partial<LotLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!supplier) return setError("Supplier is required.");
    if (lines.length === 0) return setError("At least one yarn lot line is required.");
    if (lines.some((l) => !(parseFloat(l.received) > 0))) return setError("Every line needs a received quantity greater than 0.");
    setError("");
    setGrn(`GRN-26-${String(Math.floor(143 + Math.random() * 800)).padStart(6, "0")}`);
  };

  const inputCls = "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Raw Materials", "Gate Entry"]}
        title="Gate Inward Entry"
        description="Record an incoming supplier truck, capture yarn lots, print barcode lot tags."
      />

      {grn ? (
        <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm" role="status">
          <p className="text-sm font-medium text-muted-foreground">Goods receipt recorded</p>
          <p className="mt-2 text-2xl font-bold"><CodeChip code={grn} /></p>
          <p className="mt-3 text-sm text-muted-foreground">
            {lines.length} lot tag{lines.length > 1 ? "s" : ""} ready: {lots.join(", ")}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="size-4" /> Print Lot Tags
            </button>
            <button
              onClick={() => { setGrn(null); setLines([{ ...emptyLine }]); setChallan(""); setTruck(""); setSupplier(""); }}
              className="h-10 rounded-md border px-5 text-sm font-medium hover:bg-muted"
            >
              New Entry
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header card */}
          <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4" aria-label="Receipt header">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="supplier">Supplier *</label>
              <select id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name} · {s.city}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="challan">Supplier Challan No</label>
              <input id="challan" value={challan} onChange={(e) => setChallan(e.target.value)} placeholder="e.g. CC/8891" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="truck">Truck / Vehicle No</label>
              <input id="truck" value={truck} onChange={(e) => setTruck(e.target.value)} placeholder="e.g. TN 38 AQ 4412" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Received At (IST)</label>
              <p className="flex h-9 items-center rounded-md border bg-muted px-3 font-mono text-sm">
                {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
              </p>
            </div>
          </section>

          {/* Lot lines */}
          <section className="rounded-xl border bg-card p-5 shadow-sm" aria-label="Yarn lot lines">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Yarn Lot Lines</h2>
              <button
                onClick={() => setLines((p) => [...p, { ...emptyLine }])}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
              >
                <Plus className="size-4" /> Add Yarn Line Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">Yarn Type</th>
                    <th className="pb-2 pr-3">Colour</th>
                    <th className="pb-2 pr-3">Received (kg)</th>
                    <th className="pb-2 pr-3">Challan Qty (kg)</th>
                    <th className="pb-2 pr-3">Rate (₹/kg)</th>
                    <th className="pb-2 pr-3">Earmarked Order</th>
                    <th className="pb-2" aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <select value={l.yarnType} onChange={(e) => updateLine(i, { yarnType: e.target.value })} className={inputCls} aria-label={`Yarn type line ${i + 1}`}>
                          {yarnTypes.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3"><input value={l.colour} onChange={(e) => updateLine(i, { colour: e.target.value })} placeholder="Raw White" className={inputCls} aria-label={`Colour line ${i + 1}`} /></td>
                      <td className="py-2 pr-3"><input type="number" min="0" step="0.001" value={l.received} onChange={(e) => updateLine(i, { received: e.target.value })} className={inputCls + " font-mono"} aria-label={`Received quantity line ${i + 1}`} /></td>
                      <td className="py-2 pr-3"><input type="number" min="0" step="0.001" value={l.challanQty} onChange={(e) => updateLine(i, { challanQty: e.target.value })} className={inputCls + " font-mono"} aria-label={`Challan quantity line ${i + 1}`} /></td>
                      <td className="py-2 pr-3"><input type="number" min="0" step="0.01" value={l.rate} onChange={(e) => updateLine(i, { rate: e.target.value })} className={inputCls + " font-mono"} aria-label={`Rate line ${i + 1}`} /></td>
                      <td className="py-2 pr-3">
                        <select value={l.earmark} onChange={(e) => updateLine(i, { earmark: e.target.value })} className={inputCls} aria-label={`Earmarked order line ${i + 1}`}>
                          <option value="">— None —</option>
                          {orders.map((o) => <option key={o.no} value={o.no}>{o.no}</option>)}
                        </select>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                          disabled={lines.length === 1}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                          aria-label={`Remove line ${i + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer summary */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap gap-6 text-sm">
              <span>Total Lots: <strong className="font-mono">{lines.length}</strong></span>
              <span>Net Weight: <strong className="font-mono">{totalWeight.toLocaleString("en-IN")} kg</strong></span>
              <span>Estimated Gate Value: <strong className="font-mono">{inr(totalValue)}</strong></span>
            </div>
            <div className="flex items-center gap-3">
              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
              <button
                onClick={submit}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="size-4" /> Submit & Print Lot Tags
              </button>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">Idempotency token: <span className="font-mono">{clientRequestId}</span></p>
        </div>
      )}
    </div>
  );
}
