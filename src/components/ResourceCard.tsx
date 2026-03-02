import type { ChangeNoticeState } from "../types/ecm";

export default function ResourceCard({
  title,
  description,
  state,
  author,
  timestamp,
  isClickable,
  canOpenWorkspace,
  isBusy,
  isSelected,
  onClick,
  onOpen,
}: {
  title: string;
  description: string;
  state: ChangeNoticeState;
  author: string;
  timestamp: number | bigint;
  isClickable: boolean;
  canOpenWorkspace: boolean;
  isBusy: boolean;
  isSelected: boolean;
  onClick: () => void;
  onOpen: () => void;
}) {
  const colorByState = {
    proposed: "border-amber-300 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/10",
    started: "border-blue-300 bg-blue-50 dark:border-blue-700/70 dark:bg-blue-900/10",
    completed: "border-emerald-300 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-900/10",
    cancelled: "border-rose-300 bg-rose-50 dark:border-rose-700/70 dark:bg-rose-900/10",
  } as const;

  const stateLabelClass = {
    proposed: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100",
    started: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
    completed:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100",
    cancelled: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100",
  } as const;

  const authorDisplay =
    author.includes("|") && !author.includes("@") ? "Unknown (no name/email)" : author;

  const cardClass = [
    "flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left shadow-sm transition",
    colorByState[state],
    isSelected ? "ring-2 ring-slate-400 dark:ring-slate-500" : "",
    isClickable
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
      : "cursor-default",
    isBusy ? "opacity-70" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <div className="flex items-center gap-1.5">
          {canOpenWorkspace && (
            <button
              className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-white/60 dark:border-slate-600 dark:hover:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              type="button"
            >
              Open
            </button>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${stateLabelClass[state]}`}
          >
            {state}
          </span>
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-700 dark:text-slate-200">
        {description || "No description provided."}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <p className="truncate">
          <span className="text-slate-500 dark:text-slate-400">Author:</span> {authorDisplay}
        </p>
        <p className="truncate text-right">
          <span className="text-slate-500 dark:text-slate-400">State:</span> {state}
        </p>
        <p className="col-span-2 truncate">
          <span className="text-slate-500 dark:text-slate-400">Created:</span>{" "}
          {new Date(Number(timestamp)).toLocaleString()}
        </p>
        {isClickable && (
          <p className="col-span-2 font-medium text-slate-700 dark:text-slate-200">
            {isBusy ? "Updating..." : "Click to open workspace"}
          </p>
        )}
      </div>
    </>
  );

  if (isClickable) {
    return (
      <article
        aria-disabled={isBusy}
        className={cardClass}
        onClick={() => {
          if (!isBusy) {
            onClick();
          }
        }}
        onKeyDown={(e) => {
          if (isBusy) {
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={isBusy ? -1 : 0}
      >
        {content}
      </article>
    );
  }

  return <article className={cardClass}>{content}</article>;
}
