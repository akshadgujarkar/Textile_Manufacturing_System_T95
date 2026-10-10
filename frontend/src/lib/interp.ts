import { getModelData, type AttributionModel, type ChannelMetrics } from "@/data/attribution";
import { lerp } from "@/lib/format";

/** Lerp that snaps across non-finite endpoints (dash cells like CPA "—"). */
const safeLerp = (a: number, b: number, t: number) =>
  Number.isFinite(a) && Number.isFinite(b) ? lerp(a, b, t) : t < 0.5 ? a : b;

/** Interpolates every channel metric between two attribution models. */
export function interpolateChannels(
  from: AttributionModel,
  to: AttributionModel,
  t: number,
): ChannelMetrics[] {
  const a = getModelData(from);
  const b = getModelData(to);
  if (from === to || t >= 1) return b;
  return b.map((cb, i) => {
    const ca = a[i];
    return {
      ...cb,
      share: lerp(ca.share, cb.share, t),
      revenue: lerp(ca.revenue, cb.revenue, t),
      roas: safeLerp(ca.roas, cb.roas, t),
      conversions: lerp(ca.conversions, cb.conversions, t),
      cpa: safeLerp(ca.cpa, cb.cpa, t),
      trend: cb.trend.map((v, k) => lerp(ca.trend[k], v, t)),
    };
  });
}
