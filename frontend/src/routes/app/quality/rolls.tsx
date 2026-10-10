import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Package, Search, Tag, Eye } from "lucide-react";
import { rolls, type Roll } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Finished Goods Shelf Stock · Everest Textile Mills";
const description = "Warehouse shelf inventory of all passed, in-stock fabric rolls.";

export const Route = createFileRoute("/app/quality/rolls")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: FinishedGoodsRollsPage,
});

function FinishedGoodsRollsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("in_stock");

  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      const q = search.toLowerCase();
      const matches =
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.buyer.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        (r.shelf && r.shelf.toLowerCase().includes(q));
      const statusMatch = statusFilter === "all" || r.status === statusFilter;
      return matches && statusMatch;
    });
  }, [search, statusFilter]);

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Quality", "Shelf Stock"]}
        title="Finished Goods Fabric Rolls Inventory"
        description="View warehouse shelf locations, roll specs, and QC inspection statuses."
        actions={
          <Link
            to="/app/quality/inspect"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Tag className="size-4" /> Go to QC Inspection
          </Link>
        }
      />

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roll code, buyer, product, or shelf..."
          className="h-9 w-72 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Roll Statuses</option>
          <option value="in_stock">In-Stock Shelf Only</option>
          <option value="pending_qc">Pending QC</option>
          <option value="rework">Rework</option>
          <option value="rejected">Rejected</option>
          <option value="loaded">Loaded</option>
          <option value="dispatched">Dispatched</option>
        </select>
      </div>

      <DataTable<Roll>
        rows={filteredRolls}
        rowKey={(r) => r.code}
        emptyMessage="No fabric rolls found matching your search."
        columns={[
          { key: "code", header: "Roll Code", render: (r) => <CodeChip code={r.code} /> },
          { key: "shelf", header: "Shelf Location", render: (r) => <span className="font-bold text-primary">{r.shelf || "Unassigned"}</span> },
          { key: "buyer", header: "Buyer", render: (r) => <span className="font-semibold">{r.buyer}</span> },
          { key: "product", header: "Fabric Product", render: (r) => `${r.product} (${r.colour})` },
          { key: "length", header: "Length", align: "right", className: "font-mono", render: (r) => qty(r.length, "m") },
          { key: "weight", header: "Weight", align: "right", className: "font-mono", render: (r) => qty(r.weight, "kg") },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <StatusBadge
                label={r.status.toUpperCase()}
                tone={r.status === "in_stock" ? "success" : r.status === "rejected" ? "danger" : "info"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) => (
              <Link
                to="/app/quality/traceability"
                search={{ code: r.code }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Eye className="size-3.5" /> View Pedigree
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
