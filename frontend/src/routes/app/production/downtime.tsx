import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wrench, AlertTriangle, Plus, CheckCircle2, Clock } from "lucide-react";
import { downtimeEvents, machines } from "@/data/tms";
import { date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Machine Downtime & Breakdown Log · Everest Textile Mills";
const description = "Record machine breakdowns, scheduled maintenance, and resolution history.";

export const Route = createFileRoute("/app/production/downtime")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: DowntimeLogPage,
});

function DowntimeLogPage() {
  const [events, setEvents] = useState(downtimeEvents);
  const [showModal, setShowModal] = useState(false);
  const [machineCode, setMachineCode] = useState(machines[0].code);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please enter a breakdown reason.");
      return;
    }
    const newEv = {
      machine: machineCode,
      reason,
      opened: new Date().toISOString(),
      closed: null,
      note,
    };
    setEvents([newEv, ...events]);
    setShowModal(false);
    toast.success(`Downtime logged for machine ${machineCode}.`);
  };

  const closeEvent = (index: number) => {
    setEvents((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, closed: new Date().toISOString() } : ev))
    );
    toast.success("Downtime event closed and machine restored to idle/running.");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Production", "Downtime Log"]}
        title="Machine Downtime & Breakdown Log"
        description="Track machine stoppage periods, causes, maintenance duration, and mechanic notes."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <AlertTriangle className="size-4" /> Flag New Machine Breakdown
          </button>
        }
      />

      <DataTable
        rows={events}
        rowKey={(ev, i) => ev.machine + i}
        emptyMessage="No machine downtime events logged."
        columns={[
          { key: "machine", header: "Machine Code", render: (ev) => <CodeChip code={ev.machine} /> },
          { key: "reason", header: "Breakdown Reason", render: (ev) => <span className="font-semibold">{ev.reason}</span> },
          { key: "opened", header: "Stoppage Time", render: (ev) => date(ev.opened) },
          {
            key: "status",
            header: "Status",
            render: (ev) => (
              <StatusBadge
                label={ev.closed ? "RESOLVED" : "ACTIVE BREAKDOWN"}
                tone={ev.closed ? "success" : "danger"}
              />
            ),
          },
          { key: "note", header: "Maintenance Note", render: (ev) => ev.note || "—" },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (ev, i) =>
              !ev.closed ? (
                <button
                  onClick={() => closeEvent(i as number)}
                  className="px-3 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Resolve Breakdown
                </button>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">Closed</span>
              ),
          },
        ]}
      />

      {/* Flag Breakdown Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Flag Machine Breakdown
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Select Machine *
                </label>
                <select
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none"
                >
                  {machines.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} — {m.name} ({m.stage})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Breakdown Reason *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Belt snap, Bearing noise, Motor burn..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Mechanic Notes / Spare Parts
                </label>
                <textarea
                  rows={3}
                  placeholder="Action taken or parts requested..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-md border bg-background p-3 text-sm outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90"
                >
                  Log Stoppage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
