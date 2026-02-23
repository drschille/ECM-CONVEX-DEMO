export default function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-full min-h-[5.5rem] flex-col rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-auto pt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
