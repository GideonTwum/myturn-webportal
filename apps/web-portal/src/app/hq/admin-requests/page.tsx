"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Row = {
  id: string;
  status: string;
  message: string | null;
  applicant: { email: string };
};

const ADMIN_REQUESTS_KEY = "/admin-requests";

export default function HqAdminRequestsPage() {
  const { mutate } = useSWRConfig();
  const { data: rows, error: err, isLoading: loading } = useSWR<Row[]>(
    ADMIN_REQUESTS_KEY,
    { refreshInterval: LIVE_POLL_MS },
  );
  const [pending, setPending] = useState<{
    id: string;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    setActionErr(null);
    try {
      await apiFetch(`/admin-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      void mutate(ADMIN_REQUESTS_KEY);
      void mutate("/hq/overview");
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-gray-600">
        Approve coordinators who should create and run savings groups.
      </p>
      {(err || actionErr) && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionErr ??
            (err instanceof Error ? err.message : "Failed to load requests")}
        </p>
      )}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<Row>
            columns={[
              {
                key: "email",
                header: "Applicant",
                render: (r) => (
                  <span className="font-medium text-gray-900">
                    {r.applicant.email}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "message",
                header: "Note",
                render: (r) => (
                  <span className="text-gray-600">{r.message ?? "—"}</span>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "text-right",
                render: (r) =>
                  r.status === "PENDING" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPending({ id: r.id, decision: "APPROVED" })
                        }
                        className="min-h-[40px] rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-white hover:bg-brand-green-dark sm:min-h-0"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPending({ id: r.id, decision: "REJECTED" })
                        }
                        className="min-h-[40px] rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 sm:min-h-0"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  ),
              },
            ]}
            rows={rows ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No admin requests."
          />
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        title={
          pending?.decision === "APPROVED"
            ? "Approve this admin request?"
            : "Reject this admin request?"
        }
        description={
          pending?.decision === "APPROVED"
            ? "This user will be able to create and manage savings groups."
            : "The applicant will remain a standard user."
        }
        confirmLabel={pending?.decision === "APPROVED" ? "Approve" : "Reject"}
        confirmVariant={
          pending?.decision === "APPROVED" ? "primary" : "danger"
        }
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const { id, decision } = pending;
          setPending(null);
          void review(id, decision);
        }}
      />
    </div>
  );
}
