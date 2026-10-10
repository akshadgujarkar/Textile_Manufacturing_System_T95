import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Database, Plus, Layers, Factory, AlertCircle, Boxes } from "lucide-react";
import { yarnTypes, fabricProducts, defectTypes, machines } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Master Data Catalogs · Everest Textile Mills";
const description = "Configure Yarn Types, Fabric Products, Defect Catalogs, and Machine Masters.";

export const Route = createFileRoute("/app/admin/masters")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: MasterDataPage,
});

function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<"yarn" | "fabric" | "defects" | "machines">("yarn");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Admin", "Master Data"]}
        title="Factory Master Catalogs"
        description="Central catalog definitions consumed across order planning, shop-floor production, and QC."
      />

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: "yarn", label: "Yarn Types", icon: Boxes },
          { id: "fabric", label: "Fabric Products", icon: Layers },
          { id: "defects", label: "Defect Catalog", icon: AlertCircle },
          { id: "machines", label: "Machine Master", icon: Factory },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="size-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold capitalize">{activeTab} Catalog Items</h3>
          <button
            onClick={() => toast.success(`Add new ${activeTab} item modal`)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> Add New Item
          </button>
        </div>

        {activeTab === "yarn" && (
          <div className="divide-y rounded-xl border bg-background">
            {yarnTypes.map((y, idx) => (
              <div key={idx} className="p-3 flex justify-between items-center text-sm font-semibold">
                <span>{y}</span>
                <span className="text-xs text-muted-foreground font-mono">Standard Count / Denier</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "fabric" && (
          <div className="divide-y rounded-xl border bg-background">
            {fabricProducts.map((fp) => (
              <div key={fp.id} className="p-3 flex justify-between items-center text-sm">
                <span className="font-bold">{fp.name}</span>
                <span className="text-xs font-mono font-semibold text-primary">GSM {fp.gsm}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "defects" && (
          <div className="divide-y rounded-xl border bg-background">
            {defectTypes.map((dt) => (
              <div key={dt.id} className="p-3 flex justify-between items-center text-sm">
                <span className="font-bold">{dt.label}</span>
                <CodeChip code={dt.id} />
              </div>
            ))}
          </div>
        )}

        {activeTab === "machines" && (
          <div className="divide-y rounded-xl border bg-background">
            {machines.map((m) => (
              <div key={m.code} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold">{m.name}</span>
                  <span className="text-xs text-muted-foreground block">{m.stage} Stage</span>
                </div>
                <CodeChip code={m.code} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
