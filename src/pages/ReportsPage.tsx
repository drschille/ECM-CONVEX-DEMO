import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/convexApi";
import { downloadCsv, fmtDate } from "@/lib/ecm";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { PageCard } from "./OrgDashboardPage";

export function ReportsPage({ organizationId }: { organizationId: string }) {
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const report = useQuery(api.reports.changeRequestReport, {
    organizationId: organizationId as any,
    status: status || undefined,
    priority: priority || undefined,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const exportCsv = useAction(api.reports.exportChangeRequestsCsv);

  return (
    <PageCard
      action={
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          onClick={() => {
            void (async () => {
              const result = await exportCsv({
                organizationId: organizationId as any,
                status: status || undefined,
                priority: priority || undefined,
              });
              downloadCsv(result.fileName, result.csv);
            })();
          }}
          type="button"
        >
          Export CSV
        </button>
      }
      subtitle="Filter by status/priority and export CSV."
      title="Reporting"
    >
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setStatus(e.target.value)} value={status}>
          <option value="">All statuses</option>
          {["draft", "submitted", "triage", "in_review", "approved", "implementing", "verified", "closed", "rejected"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setPriority(e.target.value)} value={priority}>
          <option value="">All priorities</option>
          {["low", "medium", "high", "critical"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">CR</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(report?.page ?? []).map((row: any) => (
              <tr key={row._id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{row.crNumber}</p>
                  <p className="text-xs text-slate-600">{row.title}</p>
                </td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                <td className="px-3 py-2"><PriorityBadge priority={row.priority} /></td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageCard>
  );
}
