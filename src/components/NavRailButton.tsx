export default function NavRailButton({
  active,
  count,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: "requests" | "notices";
  title: string;
  onClick: () => void;
}) {
  const iconSvg =
    icon === "requests" ? (
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 7h8M8 12h8M8 17h5M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 8a5 5 0 1 1 10 0v5l2 2H5l2-2V8Zm3 10a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );

  return (
    <button
      className={[
        "rounded-xl border p-3 text-left transition",
        active
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
              active
                ? "border-white/20 bg-white/10 dark:border-slate-900/15 dark:bg-slate-900/10"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
            ].join(" ")}
          >
            {iconSvg}
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">{title}</p>
          </div>
        </div>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs",
            active
              ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
          ].join(" ")}
        >
          {count}
        </span>
      </div>
    </button>
  );
}
