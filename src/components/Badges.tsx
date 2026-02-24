import { classNames } from "@/lib/ecm";

export function StatusBadge({ status }: { status: string }) {
  const color =
    {
      draft: "bg-slate-100 text-slate-700",
      submitted: "bg-amber-100 text-amber-800",
      triage: "bg-orange-100 text-orange-800",
      in_review: "bg-blue-100 text-blue-800",
      approved: "bg-emerald-100 text-emerald-800",
      implementing: "bg-cyan-100 text-cyan-800",
      verified: "bg-teal-100 text-teal-800",
      closed: "bg-slate-200 text-slate-800",
      rejected: "bg-rose-100 text-rose-800",
    }[status] ?? "bg-slate-100 text-slate-700";

  return (
    <span className={classNames("rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const color =
    {
      low: "bg-slate-100 text-slate-700",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-rose-100 text-rose-800",
    }[priority] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={classNames("rounded-full px-2 py-0.5 text-xs font-semibold", color)}>
      {priority}
    </span>
  );
}
