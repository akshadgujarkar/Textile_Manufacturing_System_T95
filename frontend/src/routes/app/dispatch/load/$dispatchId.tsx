import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ScanBarcode, Truck, AlertOctagon, CheckCircle2, ShieldAlert, ArrowLeft } from "lucide-react";
import { dispatches, rolls, type Roll } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "Truck Loading Scan Station · Everest Textile Mills";
const description = "Real-time barcode loading verification to eliminate double-dispatches and uninspected roll dispatches.";

export const Route = createFileRoute("/app/dispatch/load/$dispatchId")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: TruckLoadingScanStationPage,
});

function TruckLoadingScanStationPage() {
  const { dispatchId } = Route.useParams();
  const navigate = useNavigate();

  const manifest = useMemo(() => {
    return dispatches.find((d) => d.no === dispatchId) || dispatches[0];
  }, [dispatchId]);

  const [scannedInput, setScannedInput] = useState("");
  const [loadedRolls, setLoadedRolls] = useState<string[]>(manifest.loaded);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scannedInput.trim().toUpperCase();
    if (!code) return;

    // Check if roll exists
    const r = rolls.find((x) => x.code === code);
    if (!r) {
      setErrorModal({
        title: "INVALID ROLL BARCODE",
        message: `Barcode ${code} does not exist in mill roll registry.`,
      });
      setScannedInput("");
      return;
    }

    // Invariant 1: Roll must be passed QC
    if (r.status === "pending_qc" || r.status === "rejected" || r.status === "rework") {
      setErrorModal({
        title: "CANNOT LOAD: UNINSPECTED OR DEFECTIVE ROLL",
        message: `Roll ${code} has status '${r.status.toUpperCase()}'. Only passed 'in_stock' rolls can be loaded onto trucks.`,
      });
      setScannedInput("");
      return;
    }

    // Invariant 2: Double dispatch block
    if (loadedRolls.includes(code)) {
      setErrorModal({
        title: "DOUBLE DISPATCH BLOCKED",
        message: `Roll ${code} is ALREADY loaded inside this truck delivery manifest!`,
      });
      setScannedInput("");
      return;
    }

    // Success scan
    setLoadedRolls([...loadedRolls, code]);
    setScannedInput("");
    toast.success(`VERIFIED & LOADED: Roll ${code}`);
  };

  const handleFinalize = () => {
    toast.success(`Dispatch ${manifest.no} finalized! Delivery Challan Gate Pass generated.`);
    void navigate({ to: "/app/dispatch/challans" });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={["App", "Dispatch", "Scan Station", manifest.no]}
        title={`Truck Scan Station: ${manifest.no}`}
        description={`Target Buyer: ${manifest.buyer} | Order: ${manifest.order}`}
        actions={
          <button
            onClick={() => history.back()}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Back to Manifests
          </button>
        }
      />

      {/* Manifest Header Info */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-muted-foreground uppercase font-semibold">Truck Vehicle</span>
          <p className="text-lg font-bold font-mono text-primary">{manifest.vehicle}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground uppercase font-semibold">Driver Contact</span>
          <p className="text-sm font-semibold">{manifest.driver}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground uppercase font-semibold">Loading Status</span>
          <div className="mt-0.5">
            <StatusBadge label={manifest.status.toUpperCase()} tone="info" />
          </div>
        </div>
      </div>

      {/* Barcode Scanner Input */}
      <div className="rounded-2xl border bg-card p-6 shadow-md space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Scan Roll Barcode into Truck (e.g. R-26-000480, R-26-000481)
        </label>
        <form onSubmit={handleScanSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={scannedInput}
              onChange={(e) => setScannedInput(e.target.value)}
              placeholder="Scan barcode with handheld scanner or type..."
              autoFocus
              className="h-12 w-full rounded-xl border bg-background pl-11 pr-4 font-mono text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="px-6 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90"
          >
            Verify Scan
          </button>
        </form>
      </div>

      {/* Two-Column Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Loaded Rolls */}
        <div className="rounded-2xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" /> Scanned & Verified Rolls Inside Truck ({loadedRolls.length})
          </h3>
          <div className="divide-y rounded-xl border bg-background">
            {loadedRolls.length > 0 ? (
              loadedRolls.map((code) => {
                const r = rolls.find((x) => x.code === code);
                return (
                  <div key={code} className="p-3 flex justify-between items-center text-sm font-mono">
                    <div>
                      <span className="font-bold text-primary">{code}</span>
                      <span className="text-xs text-muted-foreground block">{r?.product}</span>
                    </div>
                    <span className="text-xs font-semibold">{r ? qty(r.length, "m") : "120m"}</span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">No rolls loaded yet.</div>
            )}
          </div>
        </div>

        {/* Right Column: Remaining / Required Items */}
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Truck className="size-5 text-primary" /> Remaining Order Items Required
          </h3>
          <div className="divide-y rounded-xl border bg-background">
            {manifest.required
              .filter((code) => !loadedRolls.includes(code))
              .map((code) => {
                const r = rolls.find((x) => x.code === code);
                return (
                  <div key={code} className="p-3 flex justify-between items-center text-sm font-mono">
                    <div>
                      <span className="font-bold text-foreground">{code}</span>
                      <span className="text-xs text-muted-foreground block">Shelf: {r?.shelf || "Shelf B-14"}</span>
                    </div>
                    <span className="text-xs text-amber-600 font-semibold">Awaiting Truck Scan</span>
                  </div>
                );
              })}
            {manifest.required.every((code) => loadedRolls.includes(code)) && (
              <div className="p-8 text-center text-xs text-emerald-600 font-bold">
                100% of required order rolls are loaded inside truck!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completion Footer */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleFinalize}
          disabled={loadedRolls.length === 0}
          className="h-14 px-8 rounded-xl bg-purple-600 text-white font-bold text-lg shadow-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Finalize Loading & Generate Gate Pass
        </button>
      </div>

      {/* Safety Invariant Red Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border-2 border-rose-500 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertOctagon className="size-8 shrink-0 animate-bounce" />
              <h3 className="text-lg font-black">{errorModal.title}</h3>
            </div>
            <p className="text-sm font-medium text-foreground">{errorModal.message}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setErrorModal(null)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700"
              >
                Acknowledge & Clear Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
