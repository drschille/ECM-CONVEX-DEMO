import { useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { fmtDate, statusLabels } from "@/lib/ecm";
import { StatusBadge } from "@/components/Badges";

export function OrgDashboardPage({ organizationId }: { organizationId: string }) {
  const data = useQuery(api.reports.dashboard, { organizationId: organizationId as any });

  if (!data) {
    return <PageCard title="Dashboard">Loading dashboard...</PageCard>;
  }

  return (
    <div className="space-y-4">
      <PageCard title="Dashboard" subtitle="Open CRs, overdue work, my assigned, and recent activity.">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Open" value={String(data.totals.open ?? 0)} />
          <Metric label="Overdue" value={String(data.totals.overdue ?? 0)} />
          <Metric label="My Assigned" value={String(data.totals.mine ?? 0)} />
        </div>
      </PageCard>

      <PageCard title="Open By Status">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          {Object.entries(data.byStatus ?? {}).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-sm font-semibold text-slate-900">{String(count)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{statusLabels[status] ?? status}</p>
            </div>
          ))}
        </div>
      </PageCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <CrsListCard title="Overdue" rows={data.overdue ?? []} />
        <CrsListCard title="Recently Updated" rows={data.recentlyUpdated ?? []} />
      </div>
    </div>
  );
}

export function PageCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CrsListCard({ title, rows }: { title: string; rows: any[] }) {
  return (
    <PageCard title={title}>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-slate-500">No records.</p>}
        {rows.map((row) => (
          <div key={row._id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.crNumber}</p>
                <p className="text-xs text-slate-600">{row.title}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Updated {fmtDate(row.updatedAt)}</p>
          </div>
        ))}
      </div>
    </PageCard>
  );
}
