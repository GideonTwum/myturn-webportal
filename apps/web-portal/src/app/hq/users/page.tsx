"use client";

import { UserRole } from "@myturn/shared";
import { LIVE_POLL_MS, useSWR } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

type UserRow = {
  id: string;
  email: string;
  role: string;
};

function toRoleEnum(r: string): UserRole {
  if (r === "SUPER_ADMIN") return UserRole.SUPER_ADMIN;
  if (r === "ADMIN") return UserRole.ADMIN;
  return UserRole.USER;
}

export default function HqUsersPage() {
  const { data: users, error: err, isLoading: loading } = useSWR<UserRow[]>(
    "/users",
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-gray-600">
        Directory for oversight (roles shown with UI labels).
      </p>
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err instanceof Error ? err.message : "Failed"}
        </p>
      )}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
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
                key: "role",
                header: "Role",
                render: (u) => <RoleBadge role={toRoleEnum(u.role)} />,
              },
            ]}
            rows={users ?? []}
            rowKey={(u) => u.id}
            emptyMessage="No users."
          />
        )}
      </div>
    </div>
  );
}
