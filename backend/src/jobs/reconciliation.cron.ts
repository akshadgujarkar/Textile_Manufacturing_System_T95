import { ReconciliationService } from '../modules/admin/reconciliation.service';

export class ReconciliationCronJob {
  private static timerHandle: NodeJS.Timeout | null = null;

  /**
   * Run reconciliation job once on demand
   */
  static async execute(): Promise<void> {
    console.log(`[RECON_CRON] [${new Date().toISOString()}] Starting invariant health check run...`);
    try {
      const report = await ReconciliationService.runAllHealthChecks();
      if (report.isHealthy) {
        console.log(`[RECON_CRON] [${new Date().toISOString()}] PASSED: System state is 100% healthy (0 anomalies across 7 invariant checks, took ${report.executionTimeMs}ms).`);
      } else {
        console.error(`[RECON_CRON] [${new Date().toISOString()}] ALERT: Invariant health check detected ${report.totalAnomalies} discrepancies!`);
        for (const [key, check] of Object.entries(report.checks)) {
          if (check.anomalyCount > 0) {
            console.error(`  - ${check.checkName} (${check.invariant}): ${check.anomalyCount} anomalies found.`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[RECON_CRON] [${new Date().toISOString()}] FAILED to execute health check:`, err.message);
    }
  }

  /**
   * Start recurring background cron job (default: runs every 24 hours, or specified interval)
   */
  static start(intervalMs = 24 * 60 * 60 * 1000): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }
    console.log(`[RECON_CRON] Scheduling background reconciliation job every ${intervalMs / 1000}s`);
    this.timerHandle = setInterval(() => {
      this.execute().catch((err) => console.error('[RECON_CRON] Execution error:', err));
    }, intervalMs);
  }

  /**
   * Stop recurring background cron job
   */
  static stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
      console.log('[RECON_CRON] Stopped background reconciliation cron.');
    }
  }
}
