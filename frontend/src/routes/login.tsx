import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Factory, ScanBarcode } from "lucide-react";
import { setUser, homeForRole } from "@/lib/tms-auth";
import { staffUsers } from "@/data/tms";

export function LoginPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(staffUsers[7].role); // owner default
  const [password, setPassword] = useState("");

  const user = staffUsers.find((u) => u.role === selected)!;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Factory className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Everest Textile Mills</h1>
          <p className="mt-1 text-sm text-muted-foreground">Textile Manufacturing System — sign in to your workspace</p>
        </div>
        <form
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setUser({ name: user.name, role: user.role, label: user.label });
            navigate(homeForRole(user.role));
          }}
        >
          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
              Staff account
            </label>
            <select
              id="role"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {staffUsers.map((u) => (
                <option key={u.role} value={u.role}>
                  {u.name} — {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Any password works in this demo"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ScanBarcode className="size-4" aria-hidden />
            Sign in to workspace
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Demo build — pick any role to see its workspace. Sessions use JWT cookies in production.
          </p>
        </form>
      </div>
    </div>
  );
}
