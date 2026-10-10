import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Factory, CheckCircle2, Delete, RotateCcw, Tag } from "lucide-react";
import { machines, staffUsers } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { toast } from "sonner";

const title = "Touch Shift Output Logger · Everest Textile Mills";
const description = "High-contrast touch kiosk interface for shop-floor operators to log shift production.";

export const Route = createFileRoute("/app/production/log-output")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
    ],
  }),
  component: TouchShiftLoggerPage,
});

export function TouchShiftLoggerPage() {
  const activeMachines = machines.filter((m) => m.jobNo);
  const [selectedMachineCode, setSelectedMachineCode] = useState(activeMachines[0]?.code || machines[0].code);
  const [shift, setShift] = useState("Shift A");
  const [operator, setOperator] = useState("Ravi Kumar");
  const [displayVal, setDisplayVal] = useState("120.0");
  const [generateTag, setGenerateTag] = useState(true);

  const selectedMachine = machines.find((m) => m.code === selectedMachineCode) || machines[0];

  const handleNumpad = (val: string) => {
    if (val === "CLEAR") {
      setDisplayVal("0");
    } else if (val === "BACKSPACE") {
      setDisplayVal((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (val === ".") {
      if (!displayVal.includes(".")) setDisplayVal((prev) => prev + ".");
    } else {
      setDisplayVal((prev) => (prev === "0" ? val : prev + val));
    }
  };

  const addPreset = (amount: number) => {
    const current = parseFloat(displayVal) || 0;
    setDisplayVal((current + amount).toFixed(1));
  };

  const handleSubmit = () => {
    const qtyNum = parseFloat(displayVal);
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Please enter a valid production output quantity.");
      return;
    }

    const rollCode = `R-26-${Math.floor(100000 + Math.random() * 900000)}`;
    toast.success(
      `Shift output of ${qtyNum} meters logged for ${selectedMachine.name}! ${
        generateTag ? `Generated Roll Tag ${rollCode}` : ""
      }`
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        breadcrumb={["App", "Production", "Touch Shift Logger"]}
        title="Shop-Floor Shift Output Logger"
        description="Touchscreen kiosk interface for machine operators to record meters produced per shift."
      />

      {/* Step 1: Select Active Machine */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Step 1: Select Machine & Running Job
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {machines.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => setSelectedMachineCode(m.code)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedMachineCode === m.code
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-500"
                  : "bg-background hover:bg-muted"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm">{m.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted">{m.code}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{m.product || "No active job"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Shift & Operator */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Step 2: Select Shift & Operator Roster
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs text-muted-foreground mb-1">Shift Period</span>
            <div className="flex gap-2">
              {["Shift A", "Shift B", "Shift C"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm border ${
                    shift === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground mb-1">Active Operator</span>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            >
              {staffUsers.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 3: Touch Numpad & Output Display */}
      <div className="rounded-2xl border bg-card p-6 shadow-md space-y-6">
        <div className="flex flex-col items-center">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Meters Produced Today
          </label>
          <div className="w-full max-w-md text-center py-4 px-6 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-5xl font-black tracking-wider shadow-inner">
            {displayVal} <span className="text-2xl text-slate-400">m</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => addPreset(50)}
            className="px-4 py-2 rounded-lg border bg-muted font-bold text-sm hover:bg-accent"
          >
            +50m
          </button>
          <button
            type="button"
            onClick={() => addPreset(100)}
            className="px-4 py-2 rounded-lg border bg-muted font-bold text-sm hover:bg-accent"
          >
            +100m
          </button>
          <button
            type="button"
            onClick={() => addPreset(120)}
            className="px-4 py-2 rounded-lg border bg-emerald-100 text-emerald-800 font-bold text-sm hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200"
          >
            +1 Roll (120m)
          </button>
        </div>

        {/* 12-Button Touch Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((btn) => (
            <button
              key={btn}
              type="button"
              onClick={() => handleNumpad(btn)}
              className="h-16 rounded-xl border bg-background text-2xl font-black hover:bg-primary/10 active:scale-95 transition-all shadow-sm"
            >
              {btn}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNumpad("BACKSPACE")}
            className="h-16 rounded-xl border bg-muted text-destructive text-sm font-bold flex items-center justify-center hover:bg-destructive/10 active:scale-95 transition-all"
          >
            <Delete className="size-6" />
          </button>
        </div>

        {/* Step 4: Tag Option & Big Submit Button */}
        <div className="space-y-4 pt-4 border-t">
          <label className="flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={generateTag}
              onChange={(e) => setGenerateTag(e.target.checked)}
              className="size-5 accent-emerald-600 rounded"
            />
            <Tag className="size-4 text-emerald-600" /> Automatically generate digital fabric roll barcode tag
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full h-16 rounded-xl bg-emerald-600 text-white font-black text-xl shadow-lg hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-3"
          >
            <CheckCircle2 className="size-7" /> SUBMIT SHIFT OUTPUT
          </button>
        </div>
      </div>
    </div>
  );
}
