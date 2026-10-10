import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getUser, homeForRole } from "@/lib/tms-auth";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Everest Textile Mills TMS" }] }),
  component: RoleHub,
});

/** Role hub dispatcher: sends each role to its primary operational screen. */
function RoleHub() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getUser();
    void navigate({ to: user ? homeForRole(user.role) : "/login", replace: true });
  }, [navigate]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading your workspace" />
    </div>
  );
}
