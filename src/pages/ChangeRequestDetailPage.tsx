import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";
import { CommentsThread } from "@/components/CommentsThread";
import { AttachmentsUploader } from "@/components/AttachmentsUploader";
import { PageCard } from "./OrgDashboardPage";

const transitions = [
  "submitted",
  "triage",
  "in_review",
  "approved",
  "implementing",
  "verified",
  "closed",
  "rejected",
] as const;

export function ChangeRequestDetailPage({ organizationId }: { organizationId: string }) {
  const { crId } = useParams<{ crId: string }>();
  const [transitionComment, setTransitionComment] = useState("");
  const detail = useQuery(
    api.changeRequests.getDetail,
    crId ? { organizationId: organizationId as any, changeRequestId: crId as any } : "skip",
  );
  const transition = useMutation(api.changeRequests.transitionStatus);
  const updateEcoChecklist = useMutation(api.eco.updateChecklist);
  const recordEcoSignoff = useMutation(api.eco.recordSignoff);

  if (!crId) return <PageCard title="Change Request">Missing CR ID.</PageCard>;
  if (!detail) return <PageCard title="Change Request">Loading...</PageCard>;

  const { changeRequest, affectedItems, approvals, attachments, comments, auditLogs, eco } = detail;

  return (
    <div className="space-y-4">
      <PageCard title={`${changeRequest.crNumber} · ${changeRequest.title}`}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={changeRequest.status} />
          <PriorityBadge priority={changeRequest.priority} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {changeRequest.changeType}
          </span>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{changeRequest.description}</p>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Reason:</span> {changeRequest.reason}
        </p>

        <div className="mt-4 grid gap-2 text-xs text-slate-600 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">Due: {fmtDate(changeRequest.dueDate)}</div>
          <div className="rounded-lg bg-slate-50 p-3">Created: {fmtDate(changeRequest.createdAt)}</div>
          <div className="rounded-lg bg-slate-50 p-3">Updated: {fmtDate(changeRequest.updatedAt)}</div>
          <div className="rounded-lg bg-slate-50 p-3">Watchers: {changeRequest.watcherProfileIds.length}</div>
        </div>

        <div className="mt-4">
          <WorkflowStepper status={changeRequest.status} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <textarea
            className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onChange={(e) => setTransitionComment(e.target.value)}
            placeholder="Transition comment (optional)"
            value={transitionComment}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {transitions.map((toStatus) => (
              <button
                key={toStatus}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                onClick={() =>
                  void transition({
                    organizationId: organizationId as any,
                    changeRequestId: crId as any,
                    toStatus,
                    comment: transitionComment || undefined,
                  })
                }
                type="button"
              >
                Move to {toStatus.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </PageCard>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <PageCard title="Affected Items">
          <div className="space-y-2">
            {(affectedItems ?? []).map((link: any) => (
              <div key={link._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">{link.itemNumberSnapshot}</p>
                <p className="text-xs text-slate-600">{link.itemNameSnapshot}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Snapshot revision: {link.currentRevisionSnapshot}
                </p>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Activity Summary">
          <div className="space-y-2 text-sm">
            <p>Approvals: {approvals?.length ?? 0}</p>
            <p>Attachments: {attachments?.length ?? 0}</p>
            <p>Comments: {comments?.length ?? 0}</p>
            <p>Audit events: {auditLogs?.length ?? 0}</p>
            <p>ECO: {eco ? eco.ecoNumber : "Not created yet"}</p>
          </div>
        </PageCard>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <ApprovalsPanel changeRequestId={crId} organizationId={organizationId} />
        <AttachmentsUploader entityId={crId} entityType="changeRequest" organizationId={organizationId} />
      </div>

      {eco && (
        <PageCard title={`ECO ${eco.ecoNumber}`} subtitle="Implementation checklist and ECO signoffs.">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              {eco.implementationChecklist.map((entry: any) => (
                <label key={entry.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                  <input
                    checked={entry.completed}
                    onChange={(e) => {
                      const next = eco.implementationChecklist.map((row: any) =>
                        row.id === entry.id ? { ...row, completed: e.target.checked } : row,
                      );
                      void updateEcoChecklist({
                        organizationId: organizationId as any,
                        ecoId: eco._id,
                        checklist: next.map((row: any) => ({
                          id: row.id,
                          label: row.label,
                          completed: row.completed,
                        })),
                      });
                    }}
                    type="checkbox"
                  />
                  <span>{entry.label}</span>
                </label>
              ))}
            </div>

            <div>
              <div className="mb-3 flex gap-2">
                <button
                  className="rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-700"
                  onClick={() =>
                    void recordEcoSignoff({
                      organizationId: organizationId as any,
                      ecoId: eco._id,
                      category: "qa",
                      decision: "approved",
                    })
                  }
                  type="button"
                >
                  QA Approve
                </button>
                <button
                  className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700"
                  onClick={() =>
                    void recordEcoSignoff({
                      organizationId: organizationId as any,
                      ecoId: eco._id,
                      category: "qa",
                      decision: "rejected",
                    })
                  }
                  type="button"
                >
                  QA Reject
                </button>
              </div>
              <div className="space-y-2">
                {(eco.signoffs ?? []).map((signoff: any, idx: number) => (
                  <div key={`${signoff.category}-${idx}`} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <p className="font-medium text-slate-900">
                      {signoff.category}: {signoff.status}
                    </p>
                    {signoff.comment && <p className="text-slate-600">{signoff.comment}</p>}
                    {signoff.decidedAt && <p className="text-slate-500">{fmtDate(signoff.decidedAt)}</p>}
                  </div>
                ))}
              </div>
              {eco.releaseNote && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Release Note</p>
                  <p className="mt-1">{eco.releaseNote}</p>
                </div>
              )}
            </div>
          </div>
        </PageCard>
      )}

      <div className="grid gap-4 2xl:grid-cols-2">
        <CommentsThread entityId={crId} entityType="changeRequest" organizationId={organizationId} />
        <PageCard title="Audit Trail">
          <div className="max-h-[28rem] space-y-2 overflow-auto">
            {(auditLogs ?? []).map((log: any) => (
              <div key={log._id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-medium text-slate-900">{log.action}</p>
                <p className="mt-1 text-slate-600">
                  {log.fromStatus && `${log.fromStatus} -> `}{log.toStatus ?? ""}
                </p>
                {log.comment && <p className="mt-1 text-slate-600">{log.comment}</p>}
                <p className="mt-1 text-slate-500">{fmtDate(log.timestamp)}</p>
              </div>
            ))}
          </div>
        </PageCard>
      </div>
    </div>
  );
}
