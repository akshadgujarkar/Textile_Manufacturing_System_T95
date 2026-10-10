/** Demo data for Everest Textile Mills TMS. Stands in for the documented
 * PostgreSQL views (v_yarn_stock, v_machine_status, v_order_status, etc.). */

export type MachineStatus = "running" | "idle" | "breakdown" | "maintenance";
export type RollStatus =
  | "pending_qc"
  | "in_stock"
  | "rework"
  | "rejected"
  | "loaded"
  | "dispatched";
export type OrderStage =
  | "awaiting_material"
  | "production_scheduled"
  | "in_production"
  | "in_qc"
  | "ready_for_dispatch"
  | "partially_dispatched"
  | "fully_dispatched";

export const suppliers = [
  { id: "sup-1", name: "Coimbatore Cotton Co.", city: "Coimbatore" },
  { id: "sup-2", name: "Surat Synthetics Ltd", city: "Surat" },
  { id: "sup-3", name: "Ludhiana Yarn Traders", city: "Ludhiana" },
  { id: "sup-4", name: "Arvind Spinning Mills", city: "Ahmedabad" },
];

export const buyers = [
  { id: "buy-1", name: "Apex Garments Ltd", city: "Tirupur", phone: "+91 98420 11223" },
  { id: "buy-2", name: "Metro Fashions", city: "Mumbai", phone: "+91 98200 44556" },
  { id: "buy-3", name: "Sunrise Exports", city: "Delhi", phone: "+91 98110 77889" },
  { id: "buy-4", name: "Kaveri Textiles", city: "Erode", phone: "+91 99430 22110" },
];

export const yarnTypes = [
  "Cotton 30s Combed",
  "Cotton 40s Carded",
  "Polyester 150D",
  "PC Blend 52/48",
  "Viscose 30s",
];

export const fabricProducts = [
  { id: "fp-1", name: "Poplin Shirting 58\"", gsm: 115 },
  { id: "fp-2", name: "Twill Suiting 60\"", gsm: 210 },
  { id: "fp-3", name: "Voile Dupatta 44\"", gsm: 62 },
  { id: "fp-4", name: "Canvas Industrial 72\"", gsm: 340 },
];

export const defectTypes = [
  { id: "hole", label: "Hole", icon: "CircleSlash" },
  { id: "colour", label: "Colour Mismatch", icon: "Palette" },
  { id: "weave", label: "Bad Weaving", icon: "Grid3x3" },
  { id: "stain", label: "Stain", icon: "Droplet" },
  { id: "selvedge", label: "Selvedge Defect", icon: "Scissors" },
  { id: "tear", label: "Tear", icon: "Zap" },
];

export interface YarnStockRow {
  yarnType: string;
  colour: string;
  unit: "kg";
  onHand: number;
  reserved: number;
  reorderLevel: number;
  avgCost: number;
}

export const yarnStock: YarnStockRow[] = [
  { yarnType: "Cotton 30s Combed", colour: "Raw White", unit: "kg", onHand: 4850, reserved: 2100, reorderLevel: 1500, avgCost: 312 },
  { yarnType: "Cotton 30s Combed", colour: "Indigo Blue", unit: "kg", onHand: 1240, reserved: 1180, reorderLevel: 900, avgCost: 348 },
  { yarnType: "Cotton 40s Carded", colour: "Raw White", unit: "kg", onHand: 3120, reserved: 400, reorderLevel: 1200, avgCost: 298 },
  { yarnType: "Polyester 150D", colour: "Jet Black", unit: "kg", onHand: 640, reserved: 610, reorderLevel: 800, avgCost: 186 },
  { yarnType: "Polyester 150D", colour: "Maroon", unit: "kg", onHand: 1980, reserved: 250, reorderLevel: 700, avgCost: 192 },
  { yarnType: "PC Blend 52/48", colour: "Sky Blue", unit: "kg", onHand: 420, reserved: 480, reorderLevel: 600, avgCost: 244 },
  { yarnType: "Viscose 30s", colour: "Cream", unit: "kg", onHand: 2200, reserved: 0, reorderLevel: 500, avgCost: 268 },
];

export const goodsReceipts = [
  { grn: "GRN-26-000142", supplier: "Coimbatore Cotton Co.", challan: "CC/8891", truck: "TN 38 AQ 4412", date: "2026-10-09T09:20:00+05:30", lots: 3, weight: 1500, value: 468000 },
  { grn: "GRN-26-000141", supplier: "Surat Synthetics Ltd", challan: "SS/2210", truck: "GJ 05 BT 9034", date: "2026-10-08T14:05:00+05:30", lots: 2, weight: 980, value: 188160 },
  { grn: "GRN-26-000140", supplier: "Ludhiana Yarn Traders", challan: "LY/5567", truck: "PB 10 CX 2211", date: "2026-10-07T11:40:00+05:30", lots: 4, weight: 2200, value: 589600 },
  { grn: "GRN-26-000139", supplier: "Arvind Spinning Mills", challan: "AS/3308", truck: "GJ 01 KT 7723", date: "2026-10-06T08:15:00+05:30", lots: 2, weight: 1100, value: 294800 },
  { grn: "GRN-26-000138", supplier: "Coimbatore Cotton Co.", challan: "CC/8840", truck: "TN 38 AQ 1180", date: "2026-10-04T16:30:00+05:30", lots: 5, weight: 2500, value: 780000 },
];

export interface Machine {
  code: string;
  name: string;
  stage: "Spinning" | "Weaving" | "Dyeing";
  status: MachineStatus;
  stateDuration: string;
  stateNote?: string;
  jobNo?: string;
  orderNo?: string;
  buyer?: string;
  product?: string;
  produced?: number;
  planned?: number;
  todayOutput?: number;
  shift?: string;
  operator?: string;
}

export const machines: Machine[] = [
  { code: "MCH-SPIN-01", name: "Ring Frame 1", stage: "Spinning", status: "running", stateDuration: "3h 42m", jobNo: "JOB-26-000104", orderNo: "ORD-26-000042", buyer: "Apex Garments Ltd", product: "Cotton 30s Combed · Raw White", produced: 1650, planned: 2400, todayOutput: 420.5, shift: "Shift A", operator: "Ravi Kumar" },
  { code: "MCH-SPIN-02", name: "Ring Frame 2", stage: "Spinning", status: "running", stateDuration: "6h 10m", jobNo: "JOB-26-000105", orderNo: "ORD-26-000045", buyer: "Metro Fashions", product: "PC Blend 52/48 · Sky Blue", produced: 980, planned: 1800, todayOutput: 388, shift: "Shift A", operator: "Suresh Yadav" },
  { code: "MCH-SPIN-03", name: "Ring Frame 3", stage: "Spinning", status: "idle", stateDuration: "1h 05m" },
  { code: "MCH-WEAV-01", name: "Rapier Loom 1", stage: "Weaving", status: "running", stateDuration: "5h 18m", jobNo: "JOB-26-000098", orderNo: "ORD-26-000042", buyer: "Apex Garments Ltd", product: "Poplin Shirting 58\" · White", produced: 3420, planned: 5000, todayOutput: 512, shift: "Shift A", operator: "Meena Devi" },
  { code: "MCH-WEAV-02", name: "Rapier Loom 2", stage: "Weaving", status: "breakdown", stateDuration: "45m", stateNote: "Belt snap", jobNo: "JOB-26-000099", orderNo: "ORD-26-000043", buyer: "Sunrise Exports", product: "Twill Suiting 60\" · Black", produced: 1210, planned: 3000, todayOutput: 96, shift: "Shift A", operator: "Arjun Singh" },
  { code: "MCH-WEAV-03", name: "Rapier Loom 3", stage: "Weaving", status: "running", stateDuration: "2h 55m", jobNo: "JOB-26-000101", orderNo: "ORD-26-000044", buyer: "Kaveri Textiles", product: "Voile Dupatta 44\" · Cream", produced: 760, planned: 1200, todayOutput: 304, shift: "Shift A", operator: "Lakshmi Nair" },
  { code: "MCH-WEAV-04", name: "Rapier Loom 4", stage: "Weaving", status: "maintenance", stateDuration: "2h 20m", stateNote: "Scheduled servicing" },
  { code: "MCH-DYE-01", name: "Jet Dyeing 1", stage: "Dyeing", status: "running", stateDuration: "1h 48m", jobNo: "JOB-26-000102", orderNo: "ORD-26-000045", buyer: "Metro Fashions", product: "Poplin Shirting 58\" · Indigo", produced: 900, planned: 1500, todayOutput: 450, shift: "Shift A", operator: "Vikram Rao" },
  { code: "MCH-DYE-02", name: "Jet Dyeing 2", stage: "Dyeing", status: "idle", stateDuration: "3h 30m" },
];

export const downtimeEvents = [
  { machine: "MCH-WEAV-02", reason: "Belt snap", opened: "2026-10-10T08:45:00+05:30", closed: null as string | null, note: "Replacement belt ordered; fitter on site" },
  { machine: "MCH-WEAV-04", reason: "Scheduled maintenance", opened: "2026-10-10T07:00:00+05:30", closed: null, note: "Quarterly servicing" },
  { machine: "MCH-SPIN-01", reason: "Bearing noise", opened: "2026-10-07T14:10:00+05:30", closed: "2026-10-07T17:40:00+05:30", note: "Bearing replaced" },
  { machine: "MCH-DYE-01", reason: "Steam valve leak", opened: "2026-10-05T10:00:00+05:30", closed: "2026-10-05T12:20:00+05:30", note: "Valve reseated" },
];

export interface OrderItem {
  product: string;
  colour: string;
  orderedQty: number;
  producedQty: number;
  passedQty: number;
  dispatchedQty: number;
  rate: number;
}

export interface Order {
  no: string;
  buyer: string;
  orderDate: string;
  promised: string;
  stage: OrderStage;
  items: OrderItem[];
}

export const orders: Order[] = [
  {
    no: "ORD-26-000042", buyer: "Apex Garments Ltd", orderDate: "2026-09-28", promised: "2026-10-14", stage: "partially_dispatched",
    items: [
      { product: "Poplin Shirting 58\"", colour: "White", orderedQty: 5000, producedQty: 4200, passedQty: 4200, dispatchedQty: 2500, rate: 96 },
      { product: "Poplin Shirting 58\"", colour: "Indigo", orderedQty: 2000, producedQty: 900, passedQty: 600, dispatchedQty: 0, rate: 104 },
    ],
  },
  {
    no: "ORD-26-000043", buyer: "Sunrise Exports", orderDate: "2026-10-01", promised: "2026-10-20", stage: "in_production",
    items: [{ product: "Twill Suiting 60\"", colour: "Black", orderedQty: 3000, producedQty: 1210, passedQty: 800, dispatchedQty: 0, rate: 148 }],
  },
  {
    no: "ORD-26-000044", buyer: "Kaveri Textiles", orderDate: "2026-10-03", promised: "2026-10-18", stage: "in_production",
    items: [{ product: "Voile Dupatta 44\"", colour: "Cream", orderedQty: 1200, producedQty: 760, passedQty: 520, dispatchedQty: 0, rate: 72 }],
  },
  {
    no: "ORD-26-000045", buyer: "Metro Fashions", orderDate: "2026-10-05", promised: "2026-10-24", stage: "production_scheduled",
    items: [{ product: "Poplin Shirting 58\"", colour: "Indigo", orderedQty: 1500, producedQty: 900, passedQty: 0, dispatchedQty: 0, rate: 106 }],
  },
  {
    no: "ORD-26-000046", buyer: "Apex Garments Ltd", orderDate: "2026-10-08", promised: "2026-10-30", stage: "awaiting_material",
    items: [{ product: "Canvas Industrial 72\"", colour: "Natural", orderedQty: 800, producedQty: 0, passedQty: 0, dispatchedQty: 0, rate: 210 }],
  },
  {
    no: "ORD-26-000039", buyer: "Metro Fashions", orderDate: "2026-09-12", promised: "2026-09-30", stage: "fully_dispatched",
    items: [{ product: "Twill Suiting 60\"", colour: "Maroon", orderedQty: 2200, producedQty: 2200, passedQty: 2200, dispatchedQty: 2200, rate: 152 }],
  },
];

export interface Roll {
  code: string;
  machine: string;
  job: string;
  order: string;
  buyer: string;
  product: string;
  colour: string;
  length: number;
  weight: number;
  status: RollStatus;
  shelf?: string;
  attempt: number;
}

export const rolls: Roll[] = [
  { code: "R-26-000482", machine: "MCH-WEAV-02", job: "JOB-26-000099", order: "ORD-26-000043", buyer: "Sunrise Exports", product: "Twill Suiting 60\"", colour: "Black", length: 120, weight: 38.4, status: "pending_qc", attempt: 1 },
  { code: "R-26-000481", machine: "MCH-WEAV-01", job: "JOB-26-000098", order: "ORD-26-000042", buyer: "Apex Garments Ltd", product: "Poplin Shirting 58\"", colour: "White", length: 120, weight: 21.2, status: "in_stock", shelf: "B-14", attempt: 1 },
  { code: "R-26-000480", machine: "MCH-WEAV-01", job: "JOB-26-000098", order: "ORD-26-000042", buyer: "Apex Garments Ltd", product: "Poplin Shirting 58\"", colour: "White", length: 118, weight: 20.9, status: "in_stock", shelf: "B-15", attempt: 1 },
  { code: "R-26-000479", machine: "MCH-WEAV-03", job: "JOB-26-000101", order: "ORD-26-000044", buyer: "Kaveri Textiles", product: "Voile Dupatta 44\"", colour: "Cream", length: 122, weight: 12.8, status: "in_stock", shelf: "C-02", attempt: 1 },
  { code: "R-26-000478", machine: "MCH-WEAV-02", job: "JOB-26-000099", order: "ORD-26-000043", buyer: "Sunrise Exports", product: "Twill Suiting 60\"", colour: "Black", length: 96, weight: 30.7, status: "rework", attempt: 2 },
  { code: "R-26-000477", machine: "MCH-DYE-01", job: "JOB-26-000102", order: "ORD-26-000045", buyer: "Metro Fashions", product: "Poplin Shirting 58\"", colour: "Indigo", length: 110, weight: 19.6, status: "rejected", attempt: 1 },
  { code: "R-26-000476", machine: "MCH-WEAV-01", job: "JOB-26-000098", order: "ORD-26-000042", buyer: "Apex Garments Ltd", product: "Poplin Shirting 58\"", colour: "White", length: 120, weight: 21.4, status: "loaded", attempt: 1 },
  { code: "R-26-000470", machine: "MCH-WEAV-01", job: "JOB-26-000095", order: "ORD-26-000039", buyer: "Metro Fashions", product: "Twill Suiting 60\"", colour: "Maroon", length: 120, weight: 38.9, status: "dispatched", attempt: 1 },
  { code: "R-26-000483", machine: "MCH-WEAV-03", job: "JOB-26-000101", order: "ORD-26-000044", buyer: "Kaveri Textiles", product: "Voile Dupatta 44\"", colour: "Cream", length: 121, weight: 12.7, status: "pending_qc", attempt: 1 },
];

export const rollTrace = {
  roll: "R-26-000481",
  yarn: { item: "Cotton 30s Combed · Raw White", lot: "LOT-26-000088", supplier: "Coimbatore Cotton Co.", grn: "GRN-26-000138", arrived: "2026-10-04T16:30:00+05:30" },
  production: { job: "JOB-26-000098", machine: "MCH-WEAV-01", stage: "Weaving", operator: "Meena Devi", date: "2026-10-08", shift: "Shift B" },
  qc: { date: "2026-10-09", inspector: "Farida Begum", result: "PASSED", defects: "1 Minor Stain @ 110m" },
  storage: { shelf: "Shelf B-14", stored: "2026-10-09" },
  dispatch: { no: "DSP-26-000019", vehicle: "TN 38 AQ 4412", order: "ORD-26-000042", buyer: "Apex Garments Ltd" },
  billing: { invoice: "INV/2026-27/000012", date: "2026-10-09", payment: "Paid" },
};

export const dispatches = [
  { no: "DSP-26-000019", buyer: "Apex Garments Ltd", order: "ORD-26-000042", vehicle: "TN 38 AQ 4412", driver: "+91 90032 55667", status: "loading" as const, loaded: ["R-26-000476"], required: ["R-26-000476", "R-26-000480", "R-26-000481"] },
  { no: "DSP-26-000018", buyer: "Metro Fashions", order: "ORD-26-000039", vehicle: "MH 04 JK 8821", driver: "+91 98211 33445", status: "dispatched" as const, loaded: ["R-26-000470"], required: ["R-26-000470"] },
  { no: "DSP-26-000017", buyer: "Kaveri Textiles", order: "ORD-26-000038", vehicle: "TN 33 BW 2290", driver: "+91 99440 88776", status: "dispatched" as const, loaded: ["R-26-000461", "R-26-000462"], required: ["R-26-000461", "R-26-000462"] },
];

export const invoices = [
  { no: "INV/2026-27/000012", buyer: "Apex Garments Ltd", date: "2026-10-09", total: 240000, paid: 240000, dispatch: "DSP-26-000016" },
  { no: "INV/2026-27/000011", buyer: "Metro Fashions", date: "2026-10-02", total: 334400, paid: 200000, dispatch: "DSP-26-000018" },
  { no: "INV/2026-27/000010", buyer: "Kaveri Textiles", date: "2026-09-28", total: 86400, paid: 0, dispatch: "DSP-26-000017" },
  { no: "INV/2026-27/000009", buyer: "Sunrise Exports", date: "2026-09-20", total: 444000, paid: 444000, dispatch: "DSP-26-000014" },
  { no: "INV/2026-27/000008", buyer: "Apex Garments Ltd", date: "2026-09-14", total: 480000, paid: 300000, dispatch: "DSP-26-000012" },
];

export const supplierBills = [
  { bill: "CC/INV/2211", supplier: "Coimbatore Cotton Co.", grn: "GRN-26-000142", date: "2026-10-09", amount: 468000, matched: true, variance: 0 },
  { bill: "SS/INV/0982", supplier: "Surat Synthetics Ltd", grn: "GRN-26-000141", date: "2026-10-08", amount: 192400, matched: false, variance: 4240 },
  { bill: "LY/INV/5567", supplier: "Ludhiana Yarn Traders", grn: "GRN-26-000140", date: "2026-10-07", amount: 589600, matched: true, variance: 0 },
  { bill: "AS/INV/3308", supplier: "Arvind Spinning Mills", grn: "GRN-26-000139", date: "2026-10-06", amount: 294800, matched: true, variance: 0 },
];

export const wageSummary = [
  { worker: "Ravi Kumar", role: "Operator · Spinning", daysPresent: 24, overtimeHrs: 12, gross: 24800, status: "approved" as const },
  { worker: "Meena Devi", role: "Operator · Weaving", daysPresent: 26, overtimeHrs: 8, gross: 26200, status: "approved" as const },
  { worker: "Arjun Singh", role: "Operator · Weaving", daysPresent: 22, overtimeHrs: 4, gross: 22100, status: "pending" as const },
  { worker: "Lakshmi Nair", role: "Operator · Weaving", daysPresent: 25, overtimeHrs: 10, gross: 25400, status: "pending" as const },
  { worker: "Farida Begum", role: "Quality Checker", daysPresent: 26, overtimeHrs: 0, gross: 23800, status: "approved" as const },
  { worker: "Vikram Rao", role: "Operator · Dyeing", daysPresent: 23, overtimeHrs: 6, gross: 22900, status: "pending" as const },
];

export const plStatement = {
  period: "October 2026 (Open)",
  revenue: 4850000,
  material: 2640000,
  wages: 820000,
  overhead: 250000,
  net: 1140000,
  margin: 23.5,
};

export const orderMargins = [
  { order: "ORD-26-000039", buyer: "Metro Fashions", revenue: 334400, cost: 221000, margin: 33.9 },
  { order: "ORD-26-000042", buyer: "Apex Garments Ltd", revenue: 688000, cost: 472000, margin: 31.4 },
  { order: "ORD-26-000043", buyer: "Sunrise Exports", revenue: 444000, cost: 318000, margin: 28.4 },
  { order: "ORD-26-000044", buyer: "Kaveri Textiles", revenue: 86400, cost: 64800, margin: 25.0 },
  { order: "ORD-26-000045", buyer: "Metro Fashions", revenue: 159000, cost: 124000, margin: 22.0 },
];

export const machineProductivity = [
  { machine: "MCH-SPIN-01", output: 8420, downtimeHrs: 3.5 },
  { machine: "MCH-SPIN-02", output: 7980, downtimeHrs: 1.2 },
  { machine: "MCH-WEAV-01", output: 11240, downtimeHrs: 0.8 },
  { machine: "MCH-WEAV-02", output: 5310, downtimeHrs: 14.6 },
  { machine: "MCH-WEAV-03", output: 6890, downtimeHrs: 2.1 },
  { machine: "MCH-DYE-01", output: 4200, downtimeHrs: 2.3 },
];

export const defectAnalytics = {
  byMachine: [
    { machine: "MCH-WEAV-01", defects: 6 },
    { machine: "MCH-WEAV-02", defects: 14 },
    { machine: "MCH-WEAV-03", defects: 4 },
    { machine: "MCH-DYE-01", defects: 5 },
  ],
  byOperator: [
    { operator: "Arjun Singh", defects: 12 },
    { operator: "Meena Devi", defects: 5 },
    { operator: "Lakshmi Nair", defects: 4 },
    { operator: "Vikram Rao", defects: 5 },
  ],
  byType: [
    { type: "Bad Weaving", count: 11 },
    { type: "Stain", count: 7 },
    { type: "Hole", count: 5 },
    { type: "Colour Mismatch", count: 4 },
    { type: "Selvedge Defect", count: 2 },
  ],
};

export const staffUsers = [
  { name: "Anil Verma", role: "gate_store", label: "Gate & Store Clerk", active: true },
  { name: "Priya Sharma", role: "production_manager", label: "Production Manager", active: true },
  { name: "Ravi Kumar", role: "operator", label: "Machine Operator", active: true },
  { name: "Farida Begum", role: "quality_checker", label: "Quality Checker", active: true },
  { name: "Deepak Nair", role: "dispatch", label: "Dispatch & Warehouse", active: true },
  { name: "Sunita Joshi", role: "sales", label: "Sales & Support", active: true },
  { name: "Manoj Gupta", role: "accounts", label: "Accounts & Finance", active: true },
  { name: "Rajesh Everest", role: "owner", label: "Mill Owner", active: true },
  { name: "System Admin", role: "admin", label: "System Administrator", active: true },
];

export const auditLog = [
  { time: "2026-10-10T09:12:00+05:30", user: "Farida Begum", action: "QC inspection recorded", entity: "R-26-000481", detail: "Result: PASSED, 1 minor defect" },
  { time: "2026-10-10T08:45:00+05:30", user: "Arjun Singh", action: "Breakdown flagged", entity: "MCH-WEAV-02", detail: "Reason: Belt snap" },
  { time: "2026-10-10T08:02:00+05:30", user: "Anil Verma", action: "Gate receipt created", entity: "GRN-26-000142", detail: "3 lots, 1,500 kg" },
  { time: "2026-10-09T17:40:00+05:30", user: "Manoj Gupta", action: "Payment allocated", entity: "INV/2026-27/000012", detail: "₹ 2,40,000 · NEFT" },
  { time: "2026-10-09T16:20:00+05:30", user: "Deepak Nair", action: "Dispatch finalized", entity: "DSP-26-000018", detail: "Gate pass generated" },
  { time: "2026-10-09T15:05:00+05:30", user: "Priya Sharma", action: "Job started", entity: "JOB-26-000105", detail: "MCH-SPIN-02 · Shift A" },
];

export const reconciliationChecks = [
  { id: "REC-1", name: "Stock balance = Σ movements", scope: "yarn_stock_balance", status: "ok" as const, detail: "7/7 balances consistent" },
  { id: "REC-2", name: "No roll on two active dispatches", scope: "dispatch_item", status: "ok" as const, detail: "0 conflicts" },
  { id: "REC-3", name: "Dispatched rolls passed QC", scope: "fabric_roll", status: "ok" as const, detail: "0 violations" },
  { id: "REC-4", name: "Invoice totals = Σ line items", scope: "invoice", status: "ok" as const, detail: "5/5 invoices consistent" },
  { id: "REC-5", name: "Payment allocations ≤ invoice balance", scope: "payment_allocation", status: "warning" as const, detail: "1 invoice over-allocated by ₹ 4,240 (INV/2026-27/000011)" },
  { id: "REC-6", name: "Order produced ≤ ordered + tolerance", scope: "order_item", status: "ok" as const, detail: "0 overproduction" },
  { id: "REC-7", name: "Open period balances roll forward", scope: "accounting_period", status: "ok" as const, detail: "October opening = September closing" },
];

export const stageLabels: Record<OrderStage, string> = {
  awaiting_material: "Awaiting Material",
  production_scheduled: "Production Scheduled",
  in_production: "In Production (Weaving)",
  in_qc: "In Quality Inspection",
  ready_for_dispatch: "Ready for Dispatch",
  partially_dispatched: "Partially Dispatched",
  fully_dispatched: "Fully Dispatched",
};

export function orderTotals(o: Order) {
  const ordered = o.items.reduce((s, i) => s + i.orderedQty, 0);
  const produced = o.items.reduce((s, i) => s + i.producedQty, 0);
  const passed = o.items.reduce((s, i) => s + i.passedQty, 0);
  const dispatched = o.items.reduce((s, i) => s + i.dispatchedQty, 0);
  const value = o.items.reduce((s, i) => s + i.orderedQty * i.rate, 0);
  return { ordered, produced, passed, dispatched, value };
}
