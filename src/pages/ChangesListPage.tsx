import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { PageCard } from "./OrgDashboardPage";

export function ChangesListPage({ organizationId }: { organizationId: string }) {
  const crs = useQuery(api.changeRequests.list, {
    organizationId: organizationId as any,
    paginationOpts: { numItems: 50, cursor: null },
  });

  return (
    <PageCard
      action={
        <Link className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white" to="new">
          New CR
        </Link>
      }
      subtitle="Engineering change requests and workflow queue."
      title="Change Requests"
    >
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">CR</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(crs?.page ?? []).map((cr: any) => (
              <tr key={cr._id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <Link className="font-semibold text-teal-700 hover:underline" to={`${cr._id}`}>
                    {cr.crNumber}
                  </Link>
                  <p className="text-xs text-slate-600">{cr.title}</p>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={cr.status} />
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={cr.priority} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(cr.dueDate)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(cr.updatedAt)}</td>
              </tr>
            ))}
            {(crs?.page ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-5 text-sm text-slate-500" colSpan={5}>
                  No change requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageCard>
  );
}
