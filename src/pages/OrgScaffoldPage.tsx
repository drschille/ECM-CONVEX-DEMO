import { useParams } from "react-router-dom";

type OrgScaffoldPageProps = {
  title: string;
  description: string;
};

export function OrgScaffoldPage({ title, description }: OrgScaffoldPageProps) {
  const params = useParams();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Org {params.orgId}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </section>
  );
}
