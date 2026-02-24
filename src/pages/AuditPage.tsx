import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/convexApi";
import { downloadCsv, fmtDate } from "@/lib/ecm";
import { PageCard } from "./OrgDashboardPage";

export function AuditPage({ organizationId }: { organizationId: string }) {
  const [entityType, setEntityType] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const logs = useQuery(api.audit.list, {
    organizationId: organizationId as any,
    entityType: entityType || undefined,
    action: actionFilter || undefined,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const exportCsv = useAction(api.audit.exportCsv);

  return (
    <PageCard
      action={
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          onClick={() => {
            void (async () => {
              const result = await exportCsv({
                organizationId: organizationId as any,
                entityType: entityType || undefined,
                action: actionFilter || undefined,
              });
              downloadCsv(result.fileName, result.csv);
            })();
          }}
          type="button"
        >
          Export CSV
        </button>
      }
      subtitle="Immutable audit trail across items, CRs, approvals, comments, ECOs, and attachments."
      title="Audit"
    >
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setEntityType(e.target.value)} placeholder="Filter entityType (changeRequest, item, eco...)" value={entityType} />
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setActionFilter(e.target.value)} placeholder="Filter action (cr_status_transition...)" value={actionFilter} />
      </div>
      <div className="space-y-2">
        {(logs?.page ?? []).map((log: any) => (
          <div key={log._id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{log.action}</p>
                <p className="text-slate-600">{log.entityType} · {log.entityId}</p>
              </div>
              <span className="text-slate-500">{fmtDate(log.timestamp)}</span>
            </div>
            {(log.fromStatus || log.toStatus) && (
              <p className="mt-1 text-slate-600">
                {log.fromStatus ?? "?"}
                {" -> "}
                {log.toStatus ?? "?"}
              </p>
            )}
            {log.comment && <p className="mt-1 text-slate-600">{log.comment}</p>}
          </div>
        ))}
      </div>
    </PageCard>
  );
}
