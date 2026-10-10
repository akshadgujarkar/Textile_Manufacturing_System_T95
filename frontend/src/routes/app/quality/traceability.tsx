import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Boxes, Factory, ClipboardCheck, Warehouse, Truck, FileText, CheckCircle2 } from "lucide-react";
import { rollTrace } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Roll Traceability Dossier · Everest Textile Mills";
const description = "Complete digital genealogy: Yarn Lot -> Job -> Machine -> Operator -> Roll -> QC -> Dispatch -> Invoice.";

export const Route = createFileRoute("/app/quality/traceability")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || "",
  }),
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: RollTraceabilityPage,
});

function RollTraceabilityPage() {
  const { code } = Route.useSearch();
  const [searchCode, setSearchCode] = useState(code || rollTrace.roll);

  const t = rollTrace;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumb={["App", "Quality", "Roll Traceability"]}
        title="Fabric Roll Digital Traceability Spine"
        description="Investigate root cause genealogy for any fabric roll code back to original raw yarn lots."
      />

      {/* Search Header */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Enter Roll Code (e.g. R-26-000481)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Type roll code..."
            className="h-10 flex-1 rounded-xl border bg-background px-4 font-mono text-base font-bold outline-none focus:ring-2 focus:ring-ring"
          />
          <button className="px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90">
            Lookup Genealogy
          </button>
        </div>
      </div>

      {/* Vertical Timeline Spine */}
      <div className="rounded-2xl border bg-card p-6 shadow-md space-y-8">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold font-mono text-primary flex items-center gap-2">
              <CodeChip code={t.roll} /> Full Genealogy Dossier
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">100% End-to-End Audit Trace Guaranteed</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs font-bold">
            <CheckCircle2 className="size-4" /> Trace Verified
          </span>
        </div>

        <div className="relative pl-6 border-l-2 border-primary/30 space-y-8">
          {/* Step 1: Raw Material */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Boxes className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">1. Raw Material Origin</span>
              <h3 className="text-base font-bold">{t.yarn.item}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block">Yarn Lot:</span>
                  <strong className="text-foreground">{t.yarn.lot}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Supplier:</span>
                  <strong className="text-foreground">{t.yarn.supplier}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Gate Receipt:</span>
                  <strong className="text-foreground">{t.yarn.grn}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Arrival Date:</span>
                  <strong className="text-foreground">04 Oct 2026</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Manufacturing */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Factory className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">2. Manufacturing Floor</span>
              <h3 className="text-base font-bold">{t.production.stage} Stage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block">Production Job:</span>
                  <strong className="text-foreground">{t.production.job}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Machine Code:</span>
                  <strong className="text-foreground">{t.production.machine}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Operator:</span>
                  <strong className="text-foreground">{t.production.operator}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Shift:</span>
                  <strong className="text-foreground">{t.production.shift} ({t.production.date})</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Quality Control */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <ClipboardCheck className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">3. Quality Inspection</span>
              <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-300">Result: {t.qc.result}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block">Inspector:</span>
                  <strong className="text-foreground">{t.qc.inspector}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Inspection Date:</span>
                  <strong className="text-foreground">{t.qc.date}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Defects Logged:</span>
                  <strong className="text-foreground">{t.qc.defects}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Storage */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-purple-600 text-white">
              <Warehouse className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-purple-600">4. Warehouse Storage</span>
              <h3 className="text-base font-bold">{t.storage.shelf}</h3>
              <p className="text-xs font-mono text-muted-foreground">Stored on {t.storage.stored}</p>
            </div>
          </div>

          {/* Step 5: Dispatch */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-sky-600 text-white">
              <Truck className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-600">5. Dispatch & Delivery</span>
              <h3 className="text-base font-bold">{t.dispatch.buyer}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block">Dispatch No:</span>
                  <strong className="text-foreground">{t.dispatch.no}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Truck Vehicle:</span>
                  <strong className="text-foreground">{t.dispatch.vehicle}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Customer Order:</span>
                  <strong className="text-foreground">{t.dispatch.order}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Step 6: Billing */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0 flex size-8 items-center justify-center rounded-full bg-amber-600 text-white">
              <FileText className="size-4" />
            </span>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">6. Sales Invoice & Payment</span>
              <h3 className="text-base font-bold">{t.billing.invoice}</h3>
              <p className="text-xs font-mono text-muted-foreground">Payment Status: <strong className="text-emerald-600">{t.billing.payment}</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
