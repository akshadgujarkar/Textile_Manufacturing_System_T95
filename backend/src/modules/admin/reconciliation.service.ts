import { TxManager } from '../../database/tx-manager';

export interface HealthCheckResult {
  checkName: string;
  viewName: string;
  description: string;
  invariant: string;
  anomalyCount: number;
  anomalies: any[];
}

export interface SystemHealthReport {
  isHealthy: boolean;
  totalAnomalies: number;
  checks: Record<string, HealthCheckResult>;
  executionTimeMs: number;
  timestamp: string;
}

export class ReconciliationService {
  /**
   * Run all 7 system reconciliation and invariant health checks
   */
  static async runAllHealthChecks(): Promise<SystemHealthReport> {
    const startTime = Date.now();

    const [
      stockBalance,
      reservedVsReservations,
      rollStatus,
      machineEvents,
      dispatchVsInvoice,
      unallocatedPayments,
      costVsIssues,
    ] = await Promise.all([
      TxManager.query<any>('SELECT * FROM v_recon_stock_balance_vs_ledger;'),
      TxManager.query<any>('SELECT * FROM v_recon_reserved_vs_reservations;'),
      TxManager.query<any>('SELECT * FROM v_recon_roll_status_vs_facts;'),
      TxManager.query<any>('SELECT * FROM v_recon_machine_events;'),
      TxManager.query<any>('SELECT * FROM v_recon_dispatch_vs_invoice;'),
      TxManager.query<any>('SELECT * FROM v_recon_unallocated_payments;'),
      TxManager.query<any>('SELECT * FROM v_recon_cost_vs_issues;'),
    ]);

    const checks: Record<string, HealthCheckResult> = {
      stockBalanceVsLedger: {
        checkName: 'Yarn Stock Balance vs Movement Ledger',
        viewName: 'v_recon_stock_balance_vs_ledger',
        description: 'Verifies cached on_hand_qty equals sum of all movements',
        invariant: 'INV-1: Cached yarn stock balance must equal ledger sum',
        anomalyCount: stockBalance.length,
        anomalies: stockBalance,
      },
      reservedVsReservations: {
        checkName: 'Yarn Reserved Qty vs Active Reservations',
        viewName: 'v_recon_reserved_vs_reservations',
        description: 'Verifies cached reserved_qty equals sum of active reservations',
        invariant: 'INV-9: Cached reserved quantity must equal active reservations sum',
        anomalyCount: reservedVsReservations.length,
        anomalies: reservedVsReservations,
      },
      rollStatusVsFacts: {
        checkName: 'Fabric Roll Status vs QC & Dispatch Facts',
        viewName: 'v_recon_roll_status_vs_facts',
        description: 'Verifies roll status aligns with actual QC results and dispatch state',
        invariant: 'Roll lifecycle status consistency',
        anomalyCount: rollStatus.length,
        anomalies: rollStatus,
      },
      machineEvents: {
        checkName: 'Machine State Events vs Running Jobs',
        viewName: 'v_recon_machine_events',
        description: 'Verifies running jobs match active open machine status events',
        invariant: 'INV-3: Exactly one open machine event state',
        anomalyCount: machineEvents.length,
        anomalies: machineEvents,
      },
      dispatchVsInvoice: {
        checkName: 'Dispatch vs Invoicing Match',
        viewName: 'v_recon_dispatch_vs_invoice',
        description: 'Verifies dispatched manifests match issued invoices',
        invariant: 'Dispatch manifest financial linkage',
        anomalyCount: dispatchVsInvoice.length,
        anomalies: dispatchVsInvoice,
      },
      unallocatedPayments: {
        checkName: 'Unallocated Buyer Payments',
        viewName: 'v_recon_unallocated_payments',
        description: 'Identifies unallocated credit balances on buyer payments',
        invariant: 'INV-6: Payment allocation limits and tracking',
        anomalyCount: unallocatedPayments.length,
        anomalies: unallocatedPayments,
      },
      costVsIssues: {
        checkName: 'Material Cost Entries vs Stock Issues',
        viewName: 'v_recon_cost_vs_issues',
        description: 'Verifies every yarn stock issue movement has a corresponding cost entry',
        invariant: 'INV-7: Cost ledger completeness for material issues',
        anomalyCount: costVsIssues.length,
        anomalies: costVsIssues,
      },
    };

    const totalAnomalies = Object.values(checks).reduce((sum, c) => sum + c.anomalyCount, 0);
    const executionTimeMs = Date.now() - startTime;

    if (totalAnomalies > 0) {
      console.warn(`[RECONCILIATION ALERT] Detected ${totalAnomalies} invariant discrepancies across system views.`);
    }

    return {
      isHealthy: totalAnomalies === 0,
      totalAnomalies,
      checks,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };
  }
}
