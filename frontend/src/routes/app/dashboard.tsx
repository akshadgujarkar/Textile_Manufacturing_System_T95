import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getUser, homeForRole } from "@/lib/tms-auth";

/** Role hub dispatcher: sends each role to its primary operational screen. */
export function DashboardPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getUser();
    navigate(user ? homeForRole(user.role) : "/login", { replace: true });
  }, [navigate]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading your workspace" />
    </div>
  );
}
