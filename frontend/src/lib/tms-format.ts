/** Formatting helpers per TMS data presentation standards (INR, IST, units). */

export function inr(value: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  return (
    "₹ " +
    value.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function qty(value: number, unit: "kg" | "m"): string {
  return (
    value.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }) +
    " " +
    unit
  );
}

export function istDate(iso: string | Date, withTime = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const base = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  if (!withTime) return base;
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${base}, ${time} IST`;
}

export function date(iso: string | Date, withTime = false): string {
  return istDate(iso, withTime);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

