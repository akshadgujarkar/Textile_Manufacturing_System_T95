import { createFileRoute } from "@tanstack/react-router";
import { Truck, FileText, Printer } from "lucide-react";
import { dispatches } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "Delivery Gate Passes & Challans · Everest Textile Mills";
const description = "Archive of generated gate passes and vehicle delivery challans.";

export const Route = createFileRoute("/app/dispatch/challans")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: DeliveryChallansPage,
});

function DeliveryChallansPage() {
  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Dispatch", "Gate Passes"]}
        title="Delivery Challans & Gate Passes"
        description="Print and verify signed gate outward delivery passes for security gate clerks."
      />

      <DataTable
        rows={dispatches}
        rowKey={(d) => d.no}
        emptyMessage="No gate passes generated."
        columns={[
          { key: "no", header: "Gate Pass / Dispatch #", render: (d) => <CodeChip code={d.no} /> },
          { key: "buyer", header: "Target Buyer", render: (d) => <span className="font-semibold">{d.buyer}</span> },
          { key: "vehicle", header: "Vehicle Number", render: (d) => <span className="font-mono text-xs">{d.vehicle}</span> },
          { key: "driver", header: "Driver Mobile", render: (d) => <span className="text-xs">{d.driver}</span> },
          { key: "rolls", header: "Total Loaded Rolls", align: "right", className: "font-mono font-bold", render: (d) => `${d.loaded.length} rolls` },
          {
            key: "status",
            header: "Security Gate Clearance",
            render: (d) => (
              <StatusBadge
                label={d.status === "dispatched" ? "PASSED OUTWARD" : "LOADING AT BAY"}
                tone={d.status === "dispatched" ? "success" : "warning"}
              />
            ),
          },
          {
            key: "actions",
            header: "Print",
            align: "right",
            render: (d) => (
              <button
                onClick={() => {
                  toast.success(`Printing Gate Pass for ${d.no}`);
                  window.print();
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold border bg-card hover:bg-accent"
              >
                <Printer className="size-3.5" /> Print Gate Pass
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
