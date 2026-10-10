import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  ClipboardCheck,
  Factory,
  FileText,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  PackageSearch,
  ScanBarcode,
  Search,
  Settings2,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearUser, getUser } from "@/lib/tms-auth";
import { yarnStock } from "@/data/tms";

const navGroups = [
  {
    label: "Raw Materials",
    icon: Boxes,
    items: [
      { to: "/app/raw-materials/stock", label: "Live Stock" },
      { to: "/app/raw-materials/gate-entry", label: "Gate Entry" },
      { to: "/app/raw-materials/receipts", label: "Receipts" },
    ],
  },
  {
    label: "Orders",
    icon: ShoppingCart,
    items: [
      { to: "/app/orders/list", label: "Orders" },
      { to: "/app/orders/new", label: "New Order" },
      { to: "/app/orders/tracking", label: "Phone Tracking" },
    ],
  },
  {
    label: "Production",
    icon: Factory,
    items: [
      { to: "/app/production/floor", label: "Live Floor" },
      { to: "/app/production/jobs", label: "Job Scheduler" },
      { to: "/app/production/log-output", label: "Shift Logger" },
      { to: "/app/production/downtime", label: "Downtime" },
    ],
  },
  {
    label: "Quality",
    icon: ClipboardCheck,
    items: [
      { to: "/app/quality/inspect", label: "QC Station" },
      { to: "/app/quality/rolls", label: "Shelf Stock" },
      { to: "/app/quality/traceability", label: "Traceability" },
      { to: "/app/quality/defect-analytics", label: "Defect Analytics" },
    ],
  },
  {
    label: "Dispatch",
    icon: Truck,
    items: [
      { to: "/app/dispatch/list", label: "Dispatches" },
      { to: "/app/dispatch/challans", label: "Gate Passes" },
    ],
  },
  {
    label: "Finance",
    icon: Landmark,
    items: [
      { to: "/app/finance/invoices", label: "Invoices" },
      { to: "/app/finance/payments", label: "Payments" },
      { to: "/app/finance/supplier-bills", label: "Supplier Bills" },
      { to: "/app/finance/wages", label: "Wages" },
      { to: "/app/finance/period-close", label: "Period Close" },
    ],
  },
  {
    label: "Executive",
    icon: Gauge,
    items: [
      { to: "/app/executive/pl-statement", label: "P&L Statement" },
      { to: "/app/executive/cost-analysis", label: "Cost Analysis" },
      { to: "/app/executive/machine-productivity", label: "Productivity" },
    ],
  },
  {
    label: "Admin",
    icon: Settings2,
    items: [
      { to: "/app/admin/users", label: "Users & Roles" },
      { to: "/app/admin/masters", label: "Master Data" },
      { to: "/app/admin/audit-log", label: "Audit Log" },
      { to: "/app/admin/reconciliation", label: "Health Checks" },
    ],
  },
] as const;

function IstClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="hidden font-mono text-xs tabular-nums text-muted-foreground md:inline" aria-label="Mill clock (IST)">
      {now
        ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) + " IST"
        : "—"}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUserState] = useState(() => getUser());

  useEffect(() => {
    if (!getUser()) {
      void navigate({ to: "/login" });
    } else {
      setUserState(getUser());
    }
  }, [navigate]);

  const lowStockCount = yarnStock.filter((y) => y.onHand - y.reserved <= y.reorderLevel).length;

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Factory className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold">Everest Textile Mills</p>
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Manufacturing System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              <group.icon className="size-3.5" aria-hidden />
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      pathname === item.to || pathname.startsWith(item.to + "/")
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>
      {/* Mobile sidebar drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4">
          <button className="rounded-md p-2 hover:bg-muted lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              aria-label="Global search: roll or order number"
              placeholder="Search roll / order # (e.g. R-26-000481, ORD-26-000042)"
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v.startsWith("R-")) void navigate({ to: "/app/quality/traceability", search: { code: v } });
                  else if (v) void navigate({ to: "/app/orders/tracking", search: { q: v } });
                }
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <IstClock />
            <Link
              to="/app/raw-materials/stock"
              className="relative rounded-md p-2 hover:bg-muted"
              aria-label={`${lowStockCount} low stock alerts`}
            >
              <Bell className="size-4.5" />
              {lowStockCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {lowStockCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {user?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("") ?? "?"}
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold">{user?.name ?? "…"}</p>
                <p className="text-[10px] text-muted-foreground">{user?.label ?? ""}</p>
              </div>
            </div>
            <button
              className="rounded-md p-2 hover:bg-muted"
              aria-label="Sign out"
              onClick={() => {
                clearUser();
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
