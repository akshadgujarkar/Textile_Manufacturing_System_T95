import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, ScanBarcode, CheckCircle2, ShieldAlert } from "lucide-react";
import { dispatches } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Dispatch Orders & Manifests · Everest Textile Mills";
const description = "List of active truck loadings, gate passes, and finalized buyer dispatches.";

export const Route = createFileRoute("/app/dispatch/list")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: DispatchListPage,
});

function DispatchListPage() {
  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Dispatch", "Dispatches"]}
        title="Truck Dispatches & Loading Manifests"
        description="Monitor physical truck loading progress, vehicle assignments, and gate pass verification."
      />

      <DataTable
        rows={dispatches}
        rowKey={(d) => d.no}
        emptyMessage="No dispatch orders found."
        columns={[
          { key: "no", header: "Dispatch #", render: (d) => <CodeChip code={d.no} /> },
          { key: "buyer", header: "Buyer", render: (d) => <span className="font-semibold">{d.buyer}</span> },
          { key: "order", header: "Order #", render: (d) => <CodeChip code={d.order} /> },
          { key: "vehicle", header: "Vehicle No", render: (d) => <span className="font-mono text-xs">{d.vehicle}</span> },
          { key: "driver", header: "Driver Contact", render: (d) => <span className="text-xs">{d.driver}</span> },
          {
            key: "progress",
            header: "Loading Progress",
            render: (d) => (
              <span className="font-mono text-xs font-bold">
                {d.loaded.length} / {d.required.length} rolls
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (d) => (
              <StatusBadge
                label={d.status.toUpperCase()}
                tone={d.status === "dispatched" ? "purple" : "info"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (d) => (
              <Link
                to="/app/dispatch/load/$dispatchId"
                params={{ dispatchId: d.no }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ScanBarcode className="size-3.5" /> Truck Scan Station
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
