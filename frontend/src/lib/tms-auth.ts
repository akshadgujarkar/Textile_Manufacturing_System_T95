/** Lightweight demo session: the selected role is stored in localStorage.
 * A real deployment would use JWT httpOnly cookies per the spec. */

export interface TmsUser {
  name: string;
  role: string;
  label: string;
}

const KEY = "tms-user";

export function getUser(): TmsUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TmsUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: TmsUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

/** Where each role lands after sign-in (role hub dispatcher). */
export function homeForRole(role: string): string {
  switch (role) {
    case "gate_store":
      return "/app/raw-materials/stock";
    case "production_manager":
      return "/app/production/floor";
    case "operator":
      return "/app/production/log-output";
    case "quality_checker":
      return "/app/quality/inspect";
    case "dispatch":
      return "/app/dispatch/list";
    case "sales":
    case "staff_readonly":
      return "/app/orders/tracking";
    case "accounts":
      return "/app/finance/invoices";
    case "owner":
      return "/app/executive/pl-statement";
    default:
      return "/app/admin/users";
  }
}
