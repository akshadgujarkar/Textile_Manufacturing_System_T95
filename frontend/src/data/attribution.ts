/**
 * ---------------------------------------------------------------------------
 * Sales by channel attribution: demo data module
 * ---------------------------------------------------------------------------
 *
 * Everything the dashboard renders is derived from the constants in this file.
 * To remix this template with your own numbers, edit only this file.
 *
 * WHERE REAL DATA WOULD CONNECT
 * -----------------------------
 * In production you would replace `CHANNELS`, `PATHS` and `WEEKLY_SHAPE`
 * with the result of a query against your warehouse, e.g.
 *
 *   const { data } = await fetchAttribution({ quarter: "2026-Q2" })
 *
 * The rest of this module (derivations, formatting, model math) can stay
 * untouched — it only depends on the shapes declared below.
 *
 * DATA INTEGRITY RULE
 * -------------------
 * Total attributed revenue and total conversions are constant across every
 * attribution model. A model only changes *how credit is distributed*, never
 * how much credit exists. Credit splits are not authored by hand — they are
 * derived from the observed journey paths below (first touch counts path
 * starts, last touch counts path ends, linear splits each path evenly), so
 * the flow field, waterfall, scatter, table and KPIs can never disagree.
 */

export type ChannelId =
  | "paid-search"
  | "paid-social"
  | "email"
  | "organic"
  | "display"
  | "referral"
  | "direct";

export type AttributionModel = "first" | "linear" | "last";

export const MODELS: { id: AttributionModel; label: string; blurb: string }[] = [
  {
    id: "first",
    label: "First touch",
    blurb: "All credit to the channel that started the journey.",
  },
  {
    id: "linear",
    label: "Linear",
    blurb: "Credit split evenly across every touchpoint in the path.",
  },
  {
    id: "last",
    label: "Last touch",
    blurb: "All credit to the channel that closed the conversion.",
  },
];

/* -------------------------------------------------------------------------
 * 1. Quarter totals — the invariants
 * ---------------------------------------------------------------------- */

export const QUARTER = {
  label: "Q2 2026",
  totalRevenue: 2_300_000,
  totalConversions: 12_500,
  roasTarget: 4,
  /** Average touchpoints per converting journey, derived from PATHS below. */
  get avgTouchpoints() {
    const total = PATHS.reduce((s, p) => s + p.share, 0);
    return PATHS.reduce((s, p) => s + p.share * p.steps.length, 0) / total;
  },
};

/* -------------------------------------------------------------------------
 * 2. Channels — identity, colour, and media spend (spend never varies by model)
 * ---------------------------------------------------------------------- */

export interface Channel {
  id: ChannelId;
  name: string;
  short: string;
  /** CSS custom property holding the channel colour (light + dark aware). */
  color: string;
  spend: number;
}

export const CHANNELS: Channel[] = [
  { id: "paid-search", name: "Paid search", short: "Search", color: "var(--ch-paid-search)", spend: 185_000 },
  { id: "paid-social", name: "Paid social", short: "Social", color: "var(--ch-paid-social)", spend: 150_000 },
  { id: "email", name: "Email", short: "Email", color: "var(--ch-email)", spend: 42_000 },
  // Organic and direct carry no media budget, like a real report. Their ROAS
  // and CPA render as dashes and they sit out of the spend-vs-return plot.
  { id: "organic", name: "Organic", short: "Organic", color: "var(--ch-organic)", spend: 0 },
  { id: "display", name: "Display", short: "Display", color: "var(--ch-display)", spend: 82_000 },
  { id: "referral", name: "Referral", short: "Referral", color: "var(--ch-referral)", spend: 34_000 },
  { id: "direct", name: "Direct", short: "Direct", color: "var(--ch-direct)", spend: 0 },
];

export const channelById = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<
  ChannelId,
  Channel
>;

export const TOTAL_SPEND = CHANNELS.reduce((sum, c) => sum + c.spend, 0);

/* -------------------------------------------------------------------------
 * 3. Credit distribution per model — derived from the observed paths
 *
 * Nothing here is authored. First touch credits the channel that starts
 * each journey, last touch the one that closes it, linear splits each
 * journey evenly across its touchpoints. Because every panel reads from
 * this same derivation, the field and the table can never tell different
 * stories.
 * ---------------------------------------------------------------------- */

function creditFromPaths(model: AttributionModel): Record<ChannelId, number> {
  const acc = Object.fromEntries(CHANNELS.map((c) => [c.id, 0])) as Record<ChannelId, number>;
  for (const p of PATHS) {
    if (model === "first") acc[p.steps[0]] += p.share;
    else if (model === "last") acc[p.steps[p.steps.length - 1]] += p.share;
    else for (const s of p.steps) acc[s] += p.share / p.steps.length;
  }
  return acc;
}

/* -------------------------------------------------------------------------
 * 4. Twelve weeks of trend shape per channel (relative index, 1 = average)
 * ---------------------------------------------------------------------- */

const WEEKLY_SHAPE: Record<ChannelId, number[]> = {
  "paid-search": [0.86, 0.9, 0.94, 0.92, 0.97, 1.01, 1.0, 1.05, 1.08, 1.06, 1.11, 1.1],
  "paid-social": [1.18, 1.12, 1.14, 1.05, 1.02, 0.98, 1.0, 0.95, 0.92, 0.94, 0.86, 0.84],
  email: [0.78, 0.82, 0.88, 1.05, 0.96, 0.93, 1.02, 1.12, 1.06, 1.14, 1.09, 1.15],
  organic: [0.92, 0.95, 0.97, 0.98, 1.0, 1.01, 1.02, 1.0, 1.03, 1.04, 1.05, 1.03],
  display: [1.22, 1.16, 1.1, 1.08, 1.02, 0.99, 0.96, 0.92, 0.9, 0.88, 0.9, 0.87],
  referral: [0.88, 0.93, 1.06, 0.99, 1.11, 0.95, 1.03, 1.08, 0.98, 1.02, 0.97, 1.0],
  direct: [0.94, 0.96, 0.99, 1.01, 0.98, 1.0, 1.02, 1.01, 1.03, 1.0, 1.02, 1.04],
};

/* -------------------------------------------------------------------------
 * 5. Observed journeys — the single source of truth for credit
 *
 * Fourteen archetypes covering all 12,500 conversions (shares sum to 1).
 * The mix is authored to mirror a real B2B SaaS quarter:
 *   - single-touch closes exist (branded search, word of mouth)
 *   - social and display start journeys but almost never close them
 *   - email never starts a journey except the outbound sequence
 *   - direct over-indexes as a closer, the classic last-touch critique
 *   - long committee deals run 6-8 touches over five to nine weeks
 * Weighted average touchpoints works out to 4.2, which the KPI derives.
 * ---------------------------------------------------------------------- */

export interface ConversionPath {
  steps: ChannelId[];
  share: number;
  daysToClose: number;
}

export const PATHS: ConversionPath[] = [
  // Short, fast closes
  { steps: ["paid-search"], share: 0.05, daysToClose: 2.6 },
  { steps: ["direct"], share: 0.03, daysToClose: 1.4 },
  { steps: ["organic", "direct"], share: 0.06, daysToClose: 7.8 },
  { steps: ["referral", "paid-search"], share: 0.03, daysToClose: 9.3 },
  // Mid-funnel nurture journeys
  { steps: ["organic", "email", "direct"], share: 0.07, daysToClose: 14.6 },
  { steps: ["paid-social", "email", "paid-search"], share: 0.09, daysToClose: 18.4 },
  { steps: ["display", "organic", "paid-search"], share: 0.06, daysToClose: 24.1 },
  { steps: ["organic", "email", "paid-social", "email"], share: 0.07, daysToClose: 19.7 },
  { steps: ["referral", "organic", "email", "paid-search"], share: 0.06, daysToClose: 21.9 },
  // Retargeting closes. Paid social and display mostly open journeys, but a
  // real quarter always has some deals that close on a retargeting ad, so
  // neither channel can sit at exactly zero credit under last touch.
  { steps: ["organic", "email", "paid-social"], share: 0.04, daysToClose: 16.2 },
  { steps: ["paid-search", "display", "paid-social"], share: 0.03, daysToClose: 22.5 },
  { steps: ["organic", "paid-search", "email", "display"], share: 0.02, daysToClose: 20.4 },
  // Full-funnel and outbound-started deals
  { steps: ["paid-social", "display", "organic", "paid-search", "email"], share: 0.09, daysToClose: 31.5 },
  { steps: ["email", "paid-search", "paid-social", "organic", "email"], share: 0.08, daysToClose: 27.3 },
  { steps: ["paid-search", "email", "referral", "organic", "email", "direct"], share: 0.08, daysToClose: 38.2 },
  // Long enterprise evaluations
  { steps: ["paid-social", "display", "email", "organic", "email", "paid-search", "organic"], share: 0.07, daysToClose: 47.6 },
  { steps: ["display", "paid-social", "organic", "email", "paid-search", "email", "organic", "referral"], share: 0.07, daysToClose: 61.4 },
];


/* -------------------------------------------------------------------------
 * 6. Derivations — nothing below needs editing to remix
 * ---------------------------------------------------------------------- */

export interface ChannelMetrics {
  id: ChannelId;
  name: string;
  short: string;
  color: string;
  spend: number;
  share: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
  trend: number[];
}

function normalise(row: Record<ChannelId, number>): Record<ChannelId, number> {
  const total = CHANNELS.reduce((sum, c) => sum + (row[c.id] ?? 0), 0);
  return Object.fromEntries(CHANNELS.map((c) => [c.id, (row[c.id] ?? 0) / total])) as Record<
    ChannelId,
    number
  >;
}

function buildModel(model: AttributionModel): ChannelMetrics[] {
  const shares = normalise(creditFromPaths(model));

  // Conversions are allocated with largest-remainder so the rounded parts
  // always sum back to exactly QUARTER.totalConversions.
  const raw = CHANNELS.map((c) => shares[c.id] * QUARTER.totalConversions);
  const floors = raw.map(Math.floor);
  let remaining = QUARTER.totalConversions - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const conversions = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    conversions[i] += 1;
    remaining -= 1;
  }

  return CHANNELS.map((c, i) => {
    const share = shares[c.id];
    const revenue = share * QUARTER.totalRevenue;
    const shape = WEEKLY_SHAPE[c.id];
    const shapeAvg = shape.reduce((a, b) => a + b, 0) / shape.length;
    return {
      id: c.id,
      name: c.name,
      short: c.short,
      color: c.color,
      spend: c.spend,
      share,
      revenue,
      // Unpaid channels have no ROAS/CPA; zero-conversion channels no CPA.
      roas: c.spend > 0 ? revenue / c.spend : Number.NaN,
      conversions: conversions[i],
      cpa: c.spend > 0 && conversions[i] > 0 ? c.spend / conversions[i] : Number.NaN,
      trend: shape.map((v) => (revenue / 12) * (v / shapeAvg)),
    };
  });
}

export const MODEL_DATA: Record<AttributionModel, ChannelMetrics[]> = {
  first: buildModel("first"),
  linear: buildModel("linear"),
  last: buildModel("last"),
};

export function getModelData(model: AttributionModel): ChannelMetrics[] {
  return MODEL_DATA[model];
}

export function topChannel(model: AttributionModel): ChannelMetrics {
  return [...MODEL_DATA[model]].sort((a, b) => b.revenue - a.revenue)[0];
}

export function bestRoasChannel(model: AttributionModel): ChannelMetrics {
  return [...MODEL_DATA[model]]
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.roas - a.roas)[0];
}

export const BLENDED_ROAS = QUARTER.totalRevenue / TOTAL_SPEND;

/* -------------------------------------------------------------------------
 * 7. Plain-language insight — the biggest true credit shift
 *
 * For the active model we find the sibling model it disagrees with most,
 * then the single channel with the largest absolute credit-share gap
 * between the two. Entirely derived: change PATHS and the sentence changes.
 * ---------------------------------------------------------------------- */

export interface CreditShift {
  channel: Channel;
  model: AttributionModel;
  share: number;
  otherModel: AttributionModel;
  otherShare: number;
}

const shareOf = (model: AttributionModel, id: ChannelId) =>
  MODEL_DATA[model].find((c) => c.id === id)!.share;

export function creditShift(model: AttributionModel): CreditShift {
  let best: CreditShift | null = null;
  for (const other of MODELS) {
    if (other.id === model) continue;
    for (const c of CHANNELS) {
      const share = shareOf(model, c.id);
      const otherShare = shareOf(other.id, c.id);
      const delta = Math.abs(share - otherShare);
      if (!best || delta > Math.abs(best.share - best.otherShare)) {
        best = { channel: c, model, share, otherModel: other.id, otherShare };
      }
    }
  }
  return best!;
}

export function modelLabel(model: AttributionModel): string {
  return MODELS.find((m) => m.id === model)!.label.toLowerCase();
}


/** Which step of a conversion path receives credit under a given model. */
export function creditedSteps(path: ConversionPath, model: AttributionModel): boolean[] {
  return path.steps.map((_, i) => {
    if (model === "first") return i === 0;
    if (model === "last") return i === path.steps.length - 1;
    return true;
  });
}

/* -------------------------------------------------------------------------
 * 8. Touchpoint share — what lane height encodes
 *
 * Each channel's share of all observed touchpoints, weighted by how common
 * each journey is. Constant across attribution models: a model changes who
 * gets credit, not who was touched.
 * ---------------------------------------------------------------------- */

export const TOUCHPOINT_SHARE: Record<ChannelId, number> = (() => {
  const acc = Object.fromEntries(CHANNELS.map((c) => [c.id, 0])) as Record<ChannelId, number>;
  let total = 0;
  for (const p of PATHS) {
    for (const s of p.steps) {
      acc[s] += p.share;
      total += p.share;
    }
  }
  for (const c of CHANNELS) acc[c.id] /= total || 1;
  return acc;
})();

/* -------------------------------------------------------------------------
 * 9. Saturation curves — modeled diminishing returns for paid channels
 *
 * Hill response curves R(s) = Vmax·s^h / (s^h + k^h), the same family MMMs
 * use for media saturation. Only the shape is authored: the half-saturation
 * point as a multiple of current spend, plus the Hill exponent. The level is
 * calibrated so each curve passes exactly through the channel's current
 * (spend, attributed revenue) point. Because revenue is model-dependent, the
 * curves re-tween with the model transition like every other panel.
 * ---------------------------------------------------------------------- */

const SATURATION: Partial<Record<ChannelId, { sat: number; h: number }>> = {
  // sat < 1 means the channel already spends past its half-saturation point.
  "paid-search": { sat: 0.9, h: 1.0 }, // branded terms cap out quickly
  "paid-social": { sat: 1.6, h: 1.25 }, // slight S-curve: needs scale to work
  email: { sat: 2.2, h: 1.1 }, // cheap sends, lots of headroom
  display: { sat: 0.7, h: 1.0 }, // deep in diminishing returns
  referral: { sat: 1.8, h: 1.15 }, // partner program still ramping
};

/** Modeled ROAS at spend level s along a channel's calibrated response curve. */
export function roasAtSpend(
  channel: { id: ChannelId; spend: number; revenue: number },
  s: number,
): number {
  const shape = SATURATION[channel.id];
  if (!shape || channel.spend <= 0 || s <= 0) return Number.NaN;
  const k = shape.sat * channel.spend;
  const hill = (v: number) =>
    Math.pow(v, shape.h) / (Math.pow(v, shape.h) + Math.pow(k, shape.h));
  const vmax = channel.revenue / hill(channel.spend);
  return (vmax * hill(s)) / s;
}
