import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";

export function ApprovalsPanel({
  organizationId,
  changeRequestId,
}: {
  organizationId: string;
  changeRequestId: string;
}) {
  const approvals = useQuery(api.approvals.listForChangeRequest, {
    organizationId: organizationId as any,
    changeRequestId: changeRequestId as any,
  });
  const summary = useQuery(api.approvals.approvalSummary, {
    organizationId: organizationId as any,
    changeRequestId: changeRequestId as any,
  });
  const decide = useMutation(api.approvals.decide);
  const [comment, setComment] = useState("");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Approvals</h3>
        <span className="text-xs text-slate-500">
          {(summary?.approvedCount ?? 0)}/{summary?.minApproverCount ?? 1} approver approvals
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 px-3 py-2">Pending: {summary?.pendingCount ?? 0}</div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">Rejected: {summary?.rejectedCount ?? 0}</div>
      </div>

      <div className="space-y-2">
        {(approvals ?? []).map((approval: any) => (
          <div key={approval._id} className="rounded-lg border border-slate-200 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{approval.category}</span>
              <span className="capitalize text-slate-600">{approval.decision}</span>
            </div>
            {approval.comment && <p className="mt-1 text-slate-600">{approval.comment}</p>}
            {approval.decidedAt && <p className="mt-1 text-slate-500">{fmtDate(approval.decidedAt)}</p>}
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <textarea
          className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onChange={(e) => setComment(e.target.value)}
          placeholder="Approval comment..."
          value={comment}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
            onClick={() =>
              void decide({
                organizationId: organizationId as any,
                changeRequestId: changeRequestId as any,
                decision: "rejected",
                comment,
              })
            }
            type="button"
          >
            Reject
          </button>
          <button
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            onClick={() =>
              void decide({
                organizationId: organizationId as any,
                changeRequestId: changeRequestId as any,
                decision: "approved",
                comment,
              })
            }
            type="button"
          >
            Approve
          </button>
        </div>
      </div>
    </section>
  );
}
