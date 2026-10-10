export type BusinessRole =
  | 'admin'
  | 'owner'
  | 'accounts'
  | 'production_manager'
  | 'operator'
  | 'quality_checker'
  | 'gate_store'
  | 'dispatch'
  | 'sales'
  | 'staff_readonly';

export interface User {
  userId: number | string;
  username: string;
  roles: BusinessRole[];
  employeeId?: number | null;
  fullName?: string;
}

export interface YarnStockItem {
  yarn_item_id: number;
  yarn_type_name: string;
  colour_name: string;
  unit_code: string;
  on_hand_qty: string | number;
  reserved_qty: string | number;
  available_qty: string | number;
  reorder_level: string | number;
  is_low_stock: boolean;
}

export interface CustomerOrder {
  id?: string;
  order_id?: number;
  order_no?: string;
  orderId?: string;
  buyer_id?: number;
  buyer_name?: string;
  customerName?: string;
  order_date?: string;
  orderDate?: string;
  promised_delivery_date?: string;
  deliveryDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'Confirmed' | 'Dispatched' | 'Delivered' | 'Draft' | any;
  total_meters?: number;
  totalMeters?: number;
  version?: number;
  items?: OrderItem[];
  itemCount?: number;
  totalAmount?: number;
}

export interface OrderItem {
  order_item_id?: number;
  product_id?: number;
  fabric_product_name?: string;
  fabricType?: string;
  colour_id?: number;
  colour_name?: string;
  color?: string;
  ordered_length_m?: number;
  meters?: number;
  unit_rate?: number;
  ratePerMeter?: number;
  produced_length_m?: number;
  status?: string;
}

export interface Machine {
  id?: string;
  machine_id?: number;
  machine_code?: string;
  stage_id?: number;
  stage_name?: string;
  stage?: string;
  description?: string;
  current_status?: 'running' | 'idle' | 'breakdown' | 'maintenance' | 'Running' | 'Idle' | 'Maintenance' | 'Breakdown' | any;
  status?: string;
  running_job_id?: number | null;
  running_job_no?: string | null;
  currentJobId?: string;
  output_meters_today?: number;
  metersToday?: number;
  speedRpm?: number;
  temperatureC?: number;
  efficiency?: number;
}

export interface ProductionJob {
  id?: string;
  job_id?: number;
  job_no?: string;
  order_item_id?: number;
  order_no?: string;
  orderId?: string;
  machine_id?: number;
  machine_code?: string;
  machineId?: string;
  stage?: string;
  operatorId?: string;
  plannedMeters?: number;
  actualMeters?: number;
  target_length_m?: number;
  actual_length_m?: number;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedShift?: string;
  status: 'planned' | 'running' | 'completed' | 'cancelled' | 'Scheduled' | 'In Progress' | 'Completed' | 'Paused' | 'Cancelled' | any;
  started_at?: string;
  completed_at?: string;
  createdAt?: string;
  version?: number;
}

export interface FabricRoll {
  id?: string;
  roll_id?: number;
  roll_code?: string;
  rollBarcode?: string;
  job_id?: number;
  job_no?: string;
  jobId?: string;
  lotNumber?: string;
  grade?: 'A' | 'B' | 'C' | 'Rejection' | any;
  length_m?: number;
  lengthMeters?: number;
  weight_kg?: number;
  weightKg?: number;
  gsm?: number;
  widthInches?: number;
  defectPoints?: number;
  defectsList?: string[];
  inspectedBy?: string;
  inspectionDate?: string;
  shelfLocation?: string;
  status?: 'draft' | 'in_stock' | 'rework' | 'rejected' | 'loaded' | 'dispatched' | 'scrapped' | 'In Stock' | 'Reserved' | 'Damaged' | any;
  created_at?: string;
  latest_qc_result?: 'passed' | 'rework' | 'rejected';
}

export interface RollTraceDossier {
  rollId?: string;
  roll_id?: number;
  roll_code?: string;
  roll_status?: string;
  grade?: string;
  length_m?: number;
  lengthMeters?: number;
  weight_kg?: number;
  weightKg?: number;
  shelfLocation?: string;
  fabric_product_name?: string;
  order_no?: string;
  orderId?: string;
  buyer_name?: string;
  customerName?: string;
  job_no?: string;
  jobId?: string;
  machine_code?: string;
  machineId?: string;
  process_stage?: string;
  operator_name?: string;
  operatorName?: string;
  shift_name?: string;
  yarn_lot_code?: string;
  yarnLotNumber?: string;
  yarn_type?: string;
  yarnCount?: string;
  yarnInwardDate?: string;
  weavingDate?: string;
  supplier_name?: string;
  supplierName?: string;
  qc_result?: string;
  qc_checker?: string;
  inspectorName?: string;
  inspectionDate?: string;
  defectPoints?: number;
  qc_defects?: Array<{ defect_name: string; severity: string }>;
  dispatch_no?: string;
  dispatchManifestId?: string;
  vehicle_no?: string;
  invoice_no?: string;
  invoiceNumber?: string;
}

export interface DispatchManifest {
  id?: string;
  dispatch_id?: number;
  dispatch_no?: string;
  buyer_id?: number;
  buyer_name?: string;
  customerName?: string;
  order_id?: number;
  order_no?: string;
  orderId?: string;
  vehicle_no?: string;
  vehicleNumber?: string;
  driver_name?: string;
  driverName?: string;
  driverPhone?: string;
  destination?: string;
  rollsCount?: number;
  totalMeters?: number;
  totalWeightKg?: number;
  loadedRolls?: string[];
  status?: 'draft' | 'loading' | 'dispatched' | 'cancelled' | 'Dispatched' | 'Loaded' | 'Pending' | any;
  dispatched_at?: string;
  dispatchDate?: string;
  scanned_rolls_count?: number;
  total_meters_loaded?: number;
  version?: number;
}

export interface Invoice {
  id?: string;
  invoice_id?: number;
  invoice_no?: string;
  orderId?: string;
  buyer_id?: number;
  buyer_name?: string;
  customerName?: string;
  customerGstin?: string;
  invoice_date?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  taxAmount?: number;
  total_amount?: number;
  totalAmount?: number;
  paid_amount?: number;
  paidAmount?: number;
  balance_amount?: number;
  status: 'draft' | 'issued' | 'voided' | 'Issued' | 'Paid' | 'Partial' | 'Overdue' | any;
  issued_at?: string;
  void_reason?: string;
}

export interface MonthlyPL {
  month?: string;
  period_id?: number;
  period_start?: string;
  period_end?: string;
  period_status?: string;
  gross_sales_revenue?: number;
  grossRevenue?: number;
  material_expense?: number;
  rawMaterialCost?: number;
  wage_expense?: number;
  laborCost?: number;
  powerAndUtilitiesCost?: number;
  maintenanceCost?: number;
  overhead_expense?: number;
  overheadCost?: number;
  total_operating_expenses?: number;
  net_profit_loss?: number;
  netProfit?: number;
  net_profit_margin_pct?: number;
  profitMarginPct?: number;
}

export interface HealthCheckReport {
  isHealthy?: boolean;
  databaseConnected?: boolean;
  orphanedRollsCount?: number;
  unmatchedGRNsCount?: number;
  discrepantLedgersCount?: number;
  schemaVersion?: string;
  lastAuditTimestamp?: string;
  overallHealthStatus?: string;
  totalAnomalies?: number;
  checks?: Record<
    string,
    {
      checkName: string;
      viewName: string;
      description: string;
      invariant: string;
      anomalyCount: number;
      anomalies: any[];
    }
  >;
  executionTimeMs?: number;
  timestamp?: string;
}

export interface AuditLogItem {
  id?: string;
  audit_id?: number;
  occurred_at?: string;
  timestamp?: string;
  actor_id?: number;
  userId?: string;
  actor_username?: string;
  userName?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DISPATCH' | 'RECONCILE' | any;
  tableName?: string;
  entity_name?: string;
  recordId?: string;
  entity_id?: string;
  changes?: any;
  before_data?: any;
  after_data?: any;
  reason?: string;
  source?: string;
  ipAddress?: string;
}
