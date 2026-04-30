"use client";

import { UserRole } from "@myturn/shared";
import { LIVE_POLL_MS, useSWR } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

type UserRow = {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
};

export default function HqAdminsCombinedPage() {
  const { data: users, error: err, isLoading: loading } = useSWR<UserRow[]>(
    "/users",
    { refreshInterval: LIVE_POLL_MS },
  );

  const admins = (users ?? []).filter((u) => u.role === UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-gray-600">
        Users with coordinator access (from full user directory).
      </p>
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err instanceof Error ? err.message : "Failed"}
        </p>
      )}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<UserRow>
            columns={[
              {
                key: "email",
                header: "Email",
                render: (u) => (
                  <span className="font-medium text-gray-900">{u.email}</span>
                ),
              },
              {
                key: "name",
                header: "Name",
                render: (u) => (
                  <span className="text-gray-600">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                  </span>
                ),
              },
              {
                key: "role",
                header: "Role",
                render: () => <RoleBadge role={UserRole.ADMIN} />,
              },
            ]}
            rows={admins}
            rowKey={(u) => u.id}
            emptyMessage="No admins in directory."
          />
        )}
      </div>
    </div>
  );
}
