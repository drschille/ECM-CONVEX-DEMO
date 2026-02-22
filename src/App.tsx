"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";

type ChangeNoticeState = "proposed" | "started" | "completed" | "cancelled";

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              ECM Demo
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Engineering Change Management
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      onClick={() => void signOut()}
      type="button"
    >
      Sign out
    </button>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Engineering Change Notices
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sign in to view and submit change notices.
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((signInError) => {
            setError(signInError.message);
          });
        }}
      >
        <input
          className="rounded-md border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          type="email"
          name="email"
          placeholder="Email"
        />
        <input
          className="rounded-md border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          type="password"
          name="password"
          placeholder="Password"
        />
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          type="submit"
        >
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>

        <div className="flex flex-row gap-2 text-sm text-slate-700 dark:text-slate-300">
          <span>
            {flow === "signIn"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            className="underline hover:no-underline"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            type="button"
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2">
            <p className="font-mono text-xs text-red-900 dark:text-red-100">
              Error signing in: {error}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

function Content() {
  const notices = useQuery(api.changes.changeNotices, {}) ?? [];
  const suggestedNoticeId = useQuery(api.changes.nextChangeNoticeId, {});
  const addChangeNotice = useMutation(api.changes.addChangeNotice);
  const startChangeNotice = useMutation(api.changes.startChangeNotice);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [startingNoticeId, setStartingNoticeId] = useState<string | null>(null);

  const proposedCount = notices.filter((notice) => notice.state === "proposed").length;
  const startedCount = notices.filter((notice) => notice.state === "started").length;
  const completedCount = notices.filter((notice) => notice.state === "completed").length;

  const openCreateModal = () => {
    setCreateError(null);
    setDraftDescription("");
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setCreateError(null);
    setDraftDescription("");
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = draftDescription.trim();

    if (!description) {
      setCreateError("Please add a description.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await addChangeNotice({ description });
      closeCreateModal();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to add change notice.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCardClick = async (notice: {
    _id: (typeof notices)[number]["_id"];
    id: string;
    state: ChangeNoticeState;
  }) => {
    if (notice.state !== "proposed") {
      return;
    }

    const confirmed = window.confirm(`Start change notice ${notice.id}?`);
    if (!confirmed) {
      return;
    }

    setStartingNoticeId(String(notice._id));
    try {
      await startChangeNotice({ noticeId: notice._id });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to start change notice.",
      );
    } finally {
      setStartingNoticeId(null);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Change Notices
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Manage engineering change notices for the current year.
            </p>
          </div>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={openCreateModal}
            type="button"
          >
            New Change Notice
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Total" value={String(notices.length)} />
          <StatTile label="Proposed" value={String(proposedCount)} />
          <StatTile label="Started" value={String(startedCount)} />
          <StatTile label="Completed" value={String(completedCount)} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {notices.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            No change notices yet. Create the first one to get started.
          </div>
        )}

        {notices.map((notice) => (
          <ResourceCard
            key={notice._id}
            title={notice.id}
            description={notice.description}
            state={notice.state}
            author={notice.author}
            timestamp={notice.timestamp}
            isClickable={notice.state === "proposed"}
            isBusy={startingNoticeId === String(notice._id)}
            onClick={() => void handleCardClick(notice)}
          />
        ))}
      </section>

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={closeCreateModal}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ecn-title"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  id="new-ecn-title"
                >
                  New Change Notice
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Suggested ID uses the current year and the next running number.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={closeCreateModal}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="flex flex-col gap-3" onSubmit={(e) => void handleCreateNotice(e)}>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <p className="text-slate-600 dark:text-slate-300">Next ID (server-generated)</p>
                <p className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                  {suggestedNoticeId ?? "Loading suggestion..."}
                </p>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Description</span>
                <textarea
                  className="min-h-28 rounded-md border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Describe the proposed change..."
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                />
              </label>

              {suggestedNoticeId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Final ID is assigned in the backend at submit time to avoid duplicate IDs.
                </p>
              )}

              {createError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-900 dark:text-red-100">
                  {createError}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={closeCreateModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  disabled={isCreating}
                  type="submit"
                >
                  {isCreating ? "Creating..." : "Create notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function ResourceCard({
  title,
  description,
  state,
  author,
  timestamp,
  isClickable,
  isBusy,
  onClick,
}: {
  title: string;
  description: string;
  state: ChangeNoticeState;
  author: string;
  timestamp: number;
  isClickable: boolean;
  isBusy: boolean;
  onClick: () => void;
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

  const cardClass = [
    "flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left shadow-sm transition",
    colorByState[state],
    isClickable
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
      : "cursor-default",
    isBusy ? "opacity-70" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${stateLabelClass[state]}`}
        >
          {state}
        </span>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-200">
        {description || "No description provided."}
      </p>

      <div className="mt-auto flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
        <p>Created: {new Date(timestamp).toLocaleString()}</p>
        <p>Author: {author}</p>
        {isClickable && (
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {isBusy ? "Starting..." : 'Click to start this notice'}
          </p>
        )}
      </div>
    </>
  );

  if (isClickable) {
    return (
      <button className={cardClass} disabled={isBusy} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <article className={cardClass}>{content}</article>;
}
