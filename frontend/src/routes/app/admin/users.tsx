import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, UserPlus, Shield, CheckCircle2 } from "lucide-react";
import { staffUsers } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "User & Role Management · Everest Textile Mills";
const description = "Manage system user accounts, role bindings, and active access status.";

export const Route = createFileRoute("/app/admin/users")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: UserManagementPage,
});

function UserManagementPage() {
  const [users, setUsers] = useState(staffUsers);

  const toggleUserStatus = (name: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.name === name ? { ...u, active: !u.active } : u))
    );
    toast.info(`Updated user access status for ${name}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Admin", "Users & Roles"]}
        title="User Accounts & Role Permissions"
        description="Configure role-based access control for Gate Clerks, Managers, QC, Accounts, and Executive Owner."
        actions={
          <button
            onClick={() => toast.success("Add user modal opened.")}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="size-4" /> Add User Account
          </button>
        }
      />

      <DataTable
        rows={users}
        rowKey={(u) => u.name}
        emptyMessage="No users found."
        columns={[
          { key: "name", header: "User Name", render: (u) => <span className="font-bold">{u.name}</span> },
          { key: "role", header: "Role Code", render: (u) => <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted font-semibold">{u.role}</span> },
          { key: "label", header: "Role Description", render: (u) => u.label },
          {
            key: "status",
            header: "Status",
            render: (u) => (
              <StatusBadge
                label={u.active ? "ACTIVE" : "INACTIVE"}
                tone={u.active ? "success" : "neutral"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (u) => (
              <button
                onClick={() => toggleUserStatus(u.name)}
                className="px-3 py-1 text-xs font-semibold rounded border bg-card hover:bg-accent"
              >
                {u.active ? "Deactivate" : "Activate"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
