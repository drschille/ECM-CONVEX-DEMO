"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";

type ChangeNoticeState = "proposed" | "started" | "completed" | "cancelled";
type SequencePrefixType = "changeRequest" | "changeNotification";

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-3">
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
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 py-8">
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
  const requests = useQuery(api.changes.changeNotices, {}) ?? [];
  const notifications = useQuery(api.changes.changeNotifications, {}) ?? [];
  const suggestedRequestId = useQuery(api.changes.nextChangeNoticeId, {});
  const suggestedNotificationId = useQuery(api.changes.nextChangeNotificationId, {});
  const sequencePrefixes = useQuery(api.changes.sequencePrefixSettings, {});
  const addChangeRequest = useMutation(api.changes.addChangeNotice);
  const addChangeNotification = useMutation(api.changes.addChangeNotification);
  const startChangeNotice = useMutation(api.changes.startChangeNotice);
  const updateSequencePrefix = useMutation(api.changes.updateSequencePrefix);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [startingNoticeId, setStartingNoticeId] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<"requests" | "notifications">("requests");
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [selectedWorkspaceKind, setSelectedWorkspaceKind] = useState<"ecr" | "ecn" | null>(null);
  const [isWorkspaceFocusMode, setIsWorkspaceFocusMode] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listStateFilter, setListStateFilter] = useState<"all" | ChangeNoticeState>("all");
  const [activePage, setActivePage] = useState<"workbench" | "setup">("workbench");
  const [prefixDrafts, setPrefixDrafts] = useState<Record<SequencePrefixType, string>>({
    changeRequest: "",
    changeNotification: "",
  });
  const [savingPrefixFor, setSavingPrefixFor] = useState<SequencePrefixType | null>(null);
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const [prefixStatus, setPrefixStatus] = useState<string | null>(null);

  const requestNotices = requests;
  const notificationNotices = notifications;
  const visibleNotices = activeLane === "requests" ? requestNotices : notificationNotices;
  const proposedCount = visibleNotices.filter((notice) => notice.state === "proposed").length;
  const startedCount = visibleNotices.filter((notice) => notice.state === "started").length;
  const completedCount = visibleNotices.filter((notice) => notice.state === "completed").length;
  const totalCount = visibleNotices.length;
  const normalizedListSearch = listSearch.trim().toLowerCase();
  const filteredVisibleNotices = visibleNotices.filter((notice) => {
    const matchesState = listStateFilter === "all" || notice.state === listStateFilter;
    if (!matchesState) {
      return false;
    }
    if (!normalizedListSearch) {
      return true;
    }
    const authorText = `${notice.authorName ?? ""} ${notice.authorEmail ?? ""} ${notice.author ?? ""}`
      .toLowerCase();
    return (
      notice.id.toLowerCase().includes(normalizedListSearch) ||
      (notice.description ?? "").toLowerCase().includes(normalizedListSearch) ||
      authorText.includes(normalizedListSearch)
    );
  });
  const selectedRequest =
    requests.find((notice) => String(notice._id) === selectedNoticeId) ?? null;
  const selectedNotification =
    notifications.find((notice) => String(notice._id) === selectedNoticeId) ?? null;
  const selectedNotice =
    selectedWorkspaceKind === "ecn"
      ? selectedNotification
      : selectedWorkspaceKind === "ecr"
        ? selectedRequest
        : null;

  useEffect(() => {
    if (!sequencePrefixes) {
      return;
    }
    setPrefixDrafts({
      changeRequest: sequencePrefixes.changeRequest,
      changeNotification: sequencePrefixes.changeNotification,
    });
  }, [sequencePrefixes]);

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

  const closeWorkspace = () => {
    setSelectedNoticeId(null);
    setSelectedWorkspaceKind(null);
    setIsWorkspaceFocusMode(false);
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
      if (activeLane === "requests") {
        await addChangeRequest({ description });
      } else {
        await addChangeNotification({ description });
      }
      closeCreateModal();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to add change notice.");
    } finally {
      setIsCreating(false);
    }
  };

  const openWorkspaceForCard = (noticeId: string, workspaceKind: "ecr" | "ecn") => {
    setSelectedWorkspaceKind(workspaceKind);
    setSelectedNoticeId(noticeId);
  };

  const handleStartNoticeFromWorkspace = async () => {
    if (!selectedRequest || selectedWorkspaceKind !== "ecr") {
      return;
    }

    const confirmed = window.confirm(`Start change request ${selectedRequest.id}?`);
    if (!confirmed) {
      return;
    }

    setStartingNoticeId(String(selectedRequest._id));
    try {
      await startChangeNotice({ noticeId: selectedRequest._id });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to start change request.",
      );
    } finally {
      setStartingNoticeId(null);
    }
  };

  const handleSavePrefix = async (sequenceType: SequencePrefixType) => {
    setPrefixError(null);
    setPrefixStatus(null);
    setSavingPrefixFor(sequenceType);
    try {
      const result = await updateSequencePrefix({
        sequenceType,
        prefix: prefixDrafts[sequenceType],
      });
      setPrefixStatus(
        `${result.sequenceType === "changeRequest" ? "Request" : "Notification"} prefix saved as ${result.prefix}.`,
      );
    } catch (error) {
      setPrefixError(error instanceof Error ? error.message : "Failed to save prefix.");
    } finally {
      setSavingPrefixFor(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          className={[
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            activePage === "workbench"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
          ].join(" ")}
          onClick={() => setActivePage("workbench")}
          type="button"
        >
          Workbench
        </button>
        <button
          className={[
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            activePage === "setup"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
          ].join(" ")}
          onClick={() => setActivePage("setup")}
          type="button"
        >
          Admin Setup
        </button>
      </div>

      {activePage === "setup" ? (
        <AdminSetupPage
          prefixDrafts={prefixDrafts}
          onPrefixChange={(sequenceType, value) =>
            setPrefixDrafts((current) => ({ ...current, [sequenceType]: value }))
          }
          onSavePrefix={(sequenceType) => void handleSavePrefix(sequenceType)}
          onResetToDefault={(sequenceType) =>
            setPrefixDrafts((current) => ({
              ...current,
              [sequenceType]: sequencePrefixes?.defaults[sequenceType] ?? "P",
            }))
          }
          suggestedRequestId={suggestedRequestId}
          suggestedNotificationId={suggestedNotificationId}
          savingPrefixFor={savingPrefixFor}
          error={prefixError}
          status={prefixStatus}
          defaults={sequencePrefixes?.defaults ?? { changeRequest: "P", changeNotification: "P" }}
        />
      ) : (
        <>
      <div
        className={
          isWorkspaceFocusMode && selectedNotice
            ? "lg:grid lg:grid-cols-1 lg:gap-4"
            : "lg:grid lg:grid-cols-[15rem_minmax(20rem,28rem)_1fr] lg:gap-4"
        }
      >
        <aside
          className={`${
            selectedNotice || (isWorkspaceFocusMode && selectedNotice) ? "hidden" : "block"
          } rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block ${
            isWorkspaceFocusMode && selectedNotice ? "lg:hidden" : ""
          }`}
        >
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Change Control
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Browse requests and notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <NavRailButton
              active={activeLane === "requests"}
              count={requestNotices.length}
              icon="requests"
              title="Requests"
              onClick={() => setActiveLane("requests")}
            />
            <NavRailButton
              active={activeLane === "notifications"}
              count={notificationNotices.length}
              icon="notices"
              title="Notices"
              onClick={() => setActiveLane("notifications")}
            />
          </div>

        </aside>

        <section
          className={`${
            selectedNotice ? "hidden" : "block"
          } mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:mt-0 lg:h-[calc(100vh-12rem)] lg:min-h-0 lg:flex lg:flex-col ${
            isWorkspaceFocusMode && selectedNotice ? "lg:hidden" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {activeLane === "requests" ? "Change Requests" : "Change Notifications"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {activeLane === "requests"
                  ? "Proposed or in-progress engineering work"
                  : "Completed or closed engineering work"}
              </p>
            </div>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={openCreateModal}
              type="button"
            >
              {activeLane === "requests" ? "New Request" : "New Notice"}
            </button>
          </div>

          <div className="mt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="sticky top-0 z-10 -mx-4 border-y border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/95">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile label="Proposed" value={String(proposedCount)} />
                <StatTile label="Started" value={String(startedCount)} />
                <StatTile label="Completed" value={String(completedCount)} />
                <StatTile
                  label={activeLane === "requests" ? "Total Requests" : "Total Notices"}
                  value={String(totalCount)}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <label className="sr-only" htmlFor="notice-list-search">
                  Search list
                </label>
                <input
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  id="notice-list-search"
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder={`Search ${activeLane === "requests" ? "requests" : "notices"}...`}
                  value={listSearch}
                />
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  onChange={(e) =>
                    setListStateFilter(e.target.value as "all" | ChangeNoticeState)
                  }
                  value={listStateFilter}
                >
                  <option value="all">All states</option>
                  <option value="proposed">Proposed</option>
                  <option value="started">Started</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredVisibleNotices.length} of {visibleNotices.length}
              </p>
            </div>

            <div className="mt-3 space-y-2.5">
            {filteredVisibleNotices.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {visibleNotices.length === 0
                  ? `No ${activeLane === "requests" ? "change requests" : "change notifications"} yet.`
                  : "No results match the current filters."}
              </div>
            )}

            {activeLane === "requests" &&
              filteredVisibleNotices.map((notice) => (
                <ResourceCard
                  key={notice._id}
                  title={notice.id}
                  description={notice.description}
                  state={notice.state}
                  author={notice.authorName ?? notice.authorEmail ?? notice.author}
                  timestamp={notice.timestamp}
                  isClickable
                  canOpenWorkspace={false}
                  isBusy={startingNoticeId === String(notice._id)}
                  isSelected={
                    selectedWorkspaceKind === "ecr" && selectedNoticeId === String(notice._id)
                  }
                  onClick={() => openWorkspaceForCard(String(notice._id), "ecr")}
                  onOpen={() => openWorkspaceForCard(String(notice._id), "ecr")}
                />
              ))}

            {activeLane === "notifications" &&
              filteredVisibleNotices.map((notice) => (
                <ResourceCard
                  key={notice._id}
                  title={notice.id}
                  description={notice.description}
                  state={notice.state}
                  author={notice.authorName ?? notice.authorEmail ?? notice.author}
                  timestamp={notice.timestamp}
                  isClickable
                  canOpenWorkspace={false}
                  isBusy={false}
                  isSelected={
                    selectedWorkspaceKind === "ecn" && selectedNoticeId === String(notice._id)
                  }
                  onClick={() => openWorkspaceForCard(String(notice._id), "ecn")}
                  onOpen={() => openWorkspaceForCard(String(notice._id), "ecn")}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          className={`${selectedNotice ? "block" : "hidden"} mt-4 min-w-0 lg:mt-0 lg:block`}
        >
          {selectedNotice ? (
            <EcnWorkspace
              notice={selectedNotice}
              workspaceKind={selectedWorkspaceKind ?? "ecr"}
              isFocusMode={isWorkspaceFocusMode}
              onStartRequest={
                selectedWorkspaceKind === "ecr" && selectedRequest
                  ? () => void handleStartNoticeFromWorkspace()
                  : undefined
              }
              isStartingRequest={
                selectedWorkspaceKind === "ecr" &&
                !!selectedRequest &&
                startingNoticeId === String(selectedRequest._id)
              }
              onToggleFocusMode={() => setIsWorkspaceFocusMode((current) => !current)}
              onClose={closeWorkspace}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Select an ECR or ECN from the list to open its workspace.
            </div>
          )}
        </section>
      </div>

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
                  {activeLane === "requests" ? "New Request" : "New Notice"}
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
                  {(activeLane === "requests"
                    ? suggestedRequestId
                    : suggestedNotificationId) ?? "Loading suggestion..."}
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

              {(activeLane === "requests" ? suggestedRequestId : suggestedNotificationId) && (
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
                  {isCreating
                    ? "Creating..."
                    : activeLane === "requests"
                      ? "Create request"
                      : "Create notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </>
  );
}

function NavRailButton({
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

function EcnWorkspace({
  notice,
  workspaceKind,
  isFocusMode,
  onStartRequest,
  isStartingRequest,
  onToggleFocusMode,
  onClose,
}: {
  notice: {
    _id: unknown;
    id: string;
    state: ChangeNoticeState;
    description: string;
  };
  workspaceKind: "ecr" | "ecn";
  isFocusMode: boolean;
  onStartRequest?: () => void;
  isStartingRequest?: boolean;
  onToggleFocusMode: () => void;
  onClose: () => void;
}) {
  const isEcrWorkspace = workspaceKind === "ecr";
  const targets = useQuery(
    api.changes.changeNoticeTargetsForEcn,
    isEcrWorkspace ? { changeNoticeId: notice._id as never } : "skip",
  );
  const suggestions = useQuery(
    api.changes.impactAnalysisSuggestionsForEcn,
    isEcrWorkspace ? { changeNoticeId: notice._id as never } : "skip",
  );
  const links = useQuery(
    api.changes.changeNoticeLinksForEcn,
    isEcrWorkspace ? { changeNoticeId: notice._id as never } : "skip",
  );
  const items = useQuery(api.products.listItems, {}) ?? [];
  const products = useQuery(api.products.listProducts, {}) ?? [];

  const addTarget = useMutation(api.changes.addChangeNoticeTarget);
  const runImpactAnalysis = useMutation(api.changes.runImpactAnalysisForEcn);
  const acceptFollowUp = useMutation(api.changes.acceptSuggestionCreateFollowUpEcn);
  const importPdmProduct = useMutation(api.products.importProductBomFromPdmPlaceholder);

  const [selectedProductNumber, setSelectedProductNumber] = useState("");
  const [targetRole, setTargetRole] = useState<"direct" | "impacted" | "candidate">("direct");
  const [changeType, setChangeType] = useState<"modify" | "add" | "remove" | "replace" | "review_only">(
    "modify",
  );
  const [targetNotes, setTargetNotes] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [pdmJson, setPdmJson] = useState(
    JSON.stringify(
      {
        sourceSystem: "autodesk_vault_professional",
        externalProductId: "Vault:12345",
        product: {
          productNumber: "ASM-1000",
          drawingNumber: "DWG-ASM-1000",
          revision: "A",
          name: "Top Assembly",
          description: "Imported from PDM placeholder payload",
        },
        bomLines: [
          {
            partNumber: "SUB-2000",
            drawingNumbers: ["DWG-SUB-2000"],
            revision: "A",
            name: "Sub Assembly",
            itemType: "product",
            quantity: 1,
          },
          {
            partNumber: "RM-STEEL-PLATE",
            revision: "1",
            name: "Steel Plate",
            itemType: "raw material",
            quantity: 2,
          },
          {
            partNumber: "SVC-LASER-CUT",
            name: "Laser Cutting Service",
            itemType: "service",
            quantity: 1,
          },
        ],
      },
      null,
      2,
    ),
  );
  const [pdmStatus, setPdmStatus] = useState<string | null>(null);
  const [pdmResult, setPdmResult] = useState<string | null>(null);
  const [isPdmImportOpen, setIsPdmImportOpen] = useState(false);
  const workspaceLabel = workspaceKind === "ecr" ? "ECR Workspace" : "ECN Workspace";

  const productOptions = products
    .map((product) => {
      const item = items.find(
        (candidate) =>
          candidate.itemType === "product" && candidate.partNumber === product.productNumber,
      );
      return {
        product,
        item,
      };
    })
    .filter((entry) => entry.item);

  const handleAddProductTarget = async () => {
    if (!selectedProductNumber) {
      setTargetError("Select a product to add to this ECN.");
      return;
    }

    const selected = productOptions.find(
      (entry) => entry.product.productNumber === selectedProductNumber,
    );
    if (!selected?.item) {
      setTargetError("Could not find the matching product item record.");
      return;
    }

    setTargetError(null);
    setTargetStatus(null);
    try {
      const result = await addTarget({
        changeNoticeId: notice._id as never,
        itemId: selected.item._id as never,
        targetRole,
        changeType,
        notes: targetNotes || undefined,
      });
      setTargetStatus(result.deduplicated ? "Target already exists." : "Target added.");
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : "Failed to add target.");
    }
  };

  const handleRunImpactAnalysis = async () => {
    setAnalysisStatus("Running impact analysis...");
    try {
      const result = await runImpactAnalysis({ changeNoticeId: notice._id as never });
      setAnalysisStatus(
        `Impact analysis complete. Created ${result.created} suggestion(s), skipped ${result.skippedDuplicates}.`,
      );
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : "Impact analysis failed.");
    }
  };

  const handleAcceptFollowUp = async (suggestionId: unknown) => {
    try {
      const result = await acceptFollowUp({ suggestionId: suggestionId as never });
      setAnalysisStatus(`Created follow-up ECN ${result.id}.`);
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : "Failed to create follow-up ECN.");
    }
  };

  const handlePdmImport = async (mode: "preview" | "upsert") => {
    setPdmStatus(`${mode === "preview" ? "Previewing" : "Importing"} payload...`);
    setPdmResult(null);
    try {
      const payload = JSON.parse(pdmJson) as {
        sourceSystem: "autodesk_vault_professional" | "other";
        externalProductId?: string;
        product: {
          productNumber: string;
          drawingNumber: string;
          revision: string;
          name: string;
          description?: string;
        };
        bomLines: Array<{
          partNumber: string;
          drawingNumbers?: string[];
          revision?: string;
          name?: string;
          description?: string;
          itemType: "product" | "raw material" | "service";
          quantity: number;
        }>;
      };

      const result = await importPdmProduct({ ...payload, mode });
      setPdmStatus(`${mode === "preview" ? "Preview" : "Import"} complete.`);
      setPdmResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setPdmStatus(error instanceof Error ? error.message : "PDM payload failed.");
    }
  };

  return (
    <>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {workspaceLabel}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {notice.id}
          </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {isEcrWorkspace && notice.state === "proposed" && onStartRequest && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              disabled={isStartingRequest}
              onClick={onStartRequest}
              type="button"
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 5v14l11-7-11-7Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              </svg>
              {isStartingRequest ? "Starting..." : "Start ECR"}
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={onToggleFocusMode}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              {isFocusMode ? (
                <path
                  d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5M10 10 4 4M14 10l6-6M14 14l6 6M10 14l-6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              ) : (
                <path
                  d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5M4 9l6-5M20 9l-6-5M20 15l-6 5M4 15l6 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              )}
            </svg>
            {isFocusMode ? "Exit Focus Mode" : "Focus Workspace"}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.9"
              />
            </svg>
            Close Workspace
          </button>
        </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100 md:text-lg">
            {notice.description || "No description provided."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          {!isEcrWorkspace && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ECN Workflow
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Opened from the ECN card. Workflow/approval actions for ECNs should be performed
                here.
              </p>
            </div>
          )}
          {isEcrWorkspace && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Product To ECR
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adds the product&apos;s item record as a target on this ECR.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Product</span>
                <select
                  className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                  value={selectedProductNumber}
                  onChange={(e) => setSelectedProductNumber(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {productOptions.map(({ product }) => (
                    <option key={String(product._id)} value={product.productNumber}>
                      {product.productNumber} - {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Target role</span>
                <select
                  className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                  value={targetRole}
                  onChange={(e) =>
                    setTargetRole(e.target.value as "direct" | "impacted" | "candidate")
                  }
                >
                  <option value="direct">direct</option>
                  <option value="impacted">impacted</option>
                  <option value="candidate">candidate</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Change type</span>
                <select
                  className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                  value={changeType}
                  onChange={(e) =>
                    setChangeType(
                      e.target.value as "modify" | "add" | "remove" | "replace" | "review_only",
                    )
                  }
                >
                  <option value="modify">modify</option>
                  <option value="add">add</option>
                  <option value="remove">remove</option>
                  <option value="replace">replace</option>
                  <option value="review_only">review_only</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Notes (optional)</span>
                <input
                  className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                  value={targetNotes}
                  onChange={(e) => setTargetNotes(e.target.value)}
                  placeholder="Why this product is included..."
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                onClick={() => void handleAddProductTarget()}
                type="button"
              >
                Add Product Target
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => void handleRunImpactAnalysis()}
                type="button"
              >
                Run Impact Analysis
              </button>
            </div>
            {targetError && (
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">{targetError}</p>
            )}
            {targetStatus && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{targetStatus}</p>
            )}
            {analysisStatus && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{analysisStatus}</p>
            )}
          </div>
          )}

          {isEcrWorkspace && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Targets</h3>
            <div className="mt-3 space-y-2 text-sm">
              {(targets ?? []).length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">No ECN targets yet.</p>
              )}
              {(targets ?? []).map((target) => (
                <div
                  className="rounded-md border border-slate-200 p-2 dark:border-slate-800"
                  key={String(target._id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{target.item?.partNumber ?? "Unknown item"}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                      {target.targetRole}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                      {target.changeType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {target.item?.name ?? "Missing item"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

        <div className="space-y-5">
          {isEcrWorkspace && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Impact Analysis Suggestions
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {(suggestions ?? []).length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  No open suggestions. Run impact analysis after adding a direct product target.
                </p>
              )}
              {(suggestions ?? []).map((suggestion) => (
                <div
                  className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
                  key={String(suggestion._id)}
                >
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {suggestion.suggestionType}
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{suggestion.reason}</p>
                  {(suggestion.suggestedPartNumber || suggestion.suggestedName) && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {suggestion.suggestedPartNumber} {suggestion.suggestedName}
                    </p>
                  )}
                  {suggestion.suggestionType === "create_follow_up_ecn" && (
                    <button
                      className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => void handleAcceptFollowUp(suggestion._id)}
                      type="button"
                    >
                      Create Follow-up ECN
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              PDM Import Placeholder (Vault Push)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Open on demand for the one-time import/preview flow for this notice.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                onClick={() => setIsPdmImportOpen(true)}
                type="button"
              >
                Open PDM Import
              </button>
            </div>
            {pdmStatus && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Last run: {pdmStatus}
              </p>
            )}
          </div>

          {isEcrWorkspace && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Linked ECNs</h3>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Parent links: {links?.asParent.length ?? 0}</p>
              <p>Child links: {links?.asChild.length ?? 0}</p>
            </div>
          </div>
          )}
        </div>
      </div>
    </section>

    {isPdmImportOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        onClick={() => setIsPdmImportOpen(false)}
        role="presentation"
      >
        <div
          className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdm-import-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                id="pdm-import-title"
              >
                PDM Import Placeholder (Vault Push)
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Simulate a middleware push from Autodesk Vault Professional into products/items.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setIsPdmImportOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <textarea
            className="mt-4 min-h-64 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            value={pdmJson}
            onChange={(e) => setPdmJson(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => void handlePdmImport("preview")}
              type="button"
            >
              Preview Payload
            </button>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              onClick={() => void handlePdmImport("upsert")}
              type="button"
            >
              Import Product + BOM
            </button>
          </div>
          {pdmStatus && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{pdmStatus}</p>
          )}
          {pdmResult && (
            <pre className="mt-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950">
              {pdmResult}
            </pre>
          )}
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

function AdminSetupPage({
  prefixDrafts,
  onPrefixChange,
  onSavePrefix,
  onResetToDefault,
  suggestedRequestId,
  suggestedNotificationId,
  savingPrefixFor,
  error,
  status,
  defaults,
}: {
  prefixDrafts: Record<SequencePrefixType, string>;
  onPrefixChange: (sequenceType: SequencePrefixType, value: string) => void;
  onSavePrefix: (sequenceType: SequencePrefixType) => void;
  onResetToDefault: (sequenceType: SequencePrefixType) => void;
  suggestedRequestId: string | undefined;
  suggestedNotificationId: string | undefined;
  savingPrefixFor: SequencePrefixType | null;
  error: string | null;
  status: string | null;
  defaults: Record<SequencePrefixType, string>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sequence Prefix Setup
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configure request and notification ID prefixes independently.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          Prefix format: 1-6 letters (A-Z)
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SequencePrefixCard
          title="Change Requests"
          sequenceType="changeRequest"
          value={prefixDrafts.changeRequest}
          defaultValue={defaults.changeRequest}
          nextId={suggestedRequestId}
          isSaving={savingPrefixFor === "changeRequest"}
          onChange={(value) => onPrefixChange("changeRequest", value)}
          onSave={() => onSavePrefix("changeRequest")}
          onResetToDefault={() => onResetToDefault("changeRequest")}
        />
        <SequencePrefixCard
          title="Change Notifications"
          sequenceType="changeNotification"
          value={prefixDrafts.changeNotification}
          defaultValue={defaults.changeNotification}
          nextId={suggestedNotificationId}
          isSaving={savingPrefixFor === "changeNotification"}
          onChange={(value) => onPrefixChange("changeNotification", value)}
          onSave={() => onSavePrefix("changeNotification")}
          onResetToDefault={() => onResetToDefault("changeNotification")}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-100">
          {error}
        </div>
      )}
      {status && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {status}
        </div>
      )}
    </section>
  );
}

function SequencePrefixCard({
  title,
  sequenceType,
  value,
  defaultValue,
  nextId,
  isSaving,
  onChange,
  onSave,
  onResetToDefault,
}: {
  title: string;
  sequenceType: SequencePrefixType;
  value: string;
  defaultValue: string;
  nextId: string | undefined;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sequence key: <span className="font-mono">{sequenceType}</span>
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={onResetToDefault}
          type="button"
        >
          Reset ({defaultValue})
        </button>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-slate-700 dark:text-slate-200">Prefix</span>
        <input
          className="rounded-md border border-slate-300 bg-white p-2 font-mono uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          maxLength={6}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={defaultValue}
          value={value}
        />
      </label>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">Next generated ID preview</p>
        <p className="mt-1 font-mono text-slate-900 dark:text-slate-100">
          {nextId ?? "Loading..."}
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          disabled={isSaving}
          onClick={onSave}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Prefix"}
        </button>
      </div>
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
  timestamp: number;
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
          {new Date(timestamp).toLocaleString()}
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
