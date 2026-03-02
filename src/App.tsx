"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import NavRailButton from "./components/NavRailButton";
import ResourceCard from "./components/ResourceCard";
import StatTile from "./components/StatTile";
import EcnWorkspace from "./features/workspace/EcnWorkspace";
import type { EcnTaskRouteTemplate, EcnWorkGroup } from "./features/workspace/types";
import { makeLocalId } from "./features/workspace/utils";
import type { ChangeNoticeState, SequencePrefixType } from "./types/ecm";
import AdminSetupPage from "./pages/AdminSetupPage";
import WorkGroupSetupPage from "./pages/WorkGroupSetupPage";

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
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 py-8">
        <Content />
      </main>
    </>
  );
}

function Content() {
  const requests = useQuery(api.changes.changeRequests, {}) ?? [];
  const notifications = useQuery(api.changes.changeNotices, {}) ?? [];
  const suggestedRequestId = useQuery(api.changes.nextChangeNoticeId, {});
  const suggestedNotificationId = useQuery(api.changes.nextChangeNotificationId, {});
  const sequencePrefixes = useQuery(api.changes.sequencePrefixSettings, {});
  const addChangeRequest = useMutation(api.changes.addChangeNotice);
  const addChangeNotification = useMutation(api.changes.addChangeNotification);
  const startChangeNotice = useMutation(api.changes.startChangeRequest);
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
  const [activePage, setActivePage] = useState<"workbench" | "workgroups" | "setup">(
    "workbench",
  );
  const [prefixDrafts, setPrefixDrafts] = useState<Record<SequencePrefixType, string>>({
    changeRequest: "",
    changeNotification: "",
  });
  const [savingPrefixFor, setSavingPrefixFor] = useState<SequencePrefixType | null>(null);
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const [prefixStatus, setPrefixStatus] = useState<string | null>(null);
  const [ecnWorkGroups, setEcnWorkGroups] = useState<EcnWorkGroup[]>(() => [
    {
      id: makeLocalId("wg"),
      name: "Design",
      owner: "design.lead@example.com",
      defaultTemplateId: "",
    },
    {
      id: makeLocalId("wg"),
      name: "Manufacturing",
      owner: "mfg.owner@example.com",
      defaultTemplateId: "",
    },
    {
      id: makeLocalId("wg"),
      name: "Quality",
      owner: "quality.owner@example.com",
      defaultTemplateId: "",
    },
  ]);
  const [ecnTaskRouteTemplates, setEcnTaskRouteTemplates] = useState<EcnTaskRouteTemplate[]>(() => [
    {
      id: makeLocalId("tpl"),
      name: "Design review route",
      tasks: ["Review drawing", "Update BOM references", "Approve design package"],
    },
    {
      id: makeLocalId("tpl"),
      name: "MFG change route",
      tasks: ["Review tooling impact", "Update traveler/work instructions", "Schedule pilot run"],
    },
    {
      id: makeLocalId("tpl"),
      name: "Quality validation route",
      tasks: ["Update control plan", "Define inspection points", "Sign off validation"],
    },
  ]);

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

  const handleAddWorkGroup = () => {
    setEcnWorkGroups((current) => [
      ...current,
      { id: makeLocalId("wg"), name: "New Group", owner: "", defaultTemplateId: "" },
    ]);
  };

  const handleRemoveWorkGroup = (workGroupId: string) => {
    setEcnWorkGroups((current) => current.filter((group) => group.id !== workGroupId));
  };

  const handleAddTaskRouteTemplate = () => {
    setEcnTaskRouteTemplates((current) => [
      ...current,
      { id: makeLocalId("tpl"), name: "New route template", tasks: ["Define task"] },
    ]);
  };

  const handleRemoveTaskRouteTemplate = (templateId: string) => {
    setEcnTaskRouteTemplates((current) => current.filter((template) => template.id !== templateId));
    setEcnWorkGroups((current) =>
      current.map((group) =>
        group.defaultTemplateId === templateId ? { ...group, defaultTemplateId: "" } : group,
      ),
    );
  };

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
      await startChangeNotice({ requestId: selectedRequest._id });
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
            activePage === "workgroups"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
          ].join(" ")}
          onClick={() => setActivePage("workgroups")}
          type="button"
        >
          Work Groups
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
      ) : activePage === "workgroups" ? (
        <WorkGroupSetupPage
          workGroups={ecnWorkGroups}
          setWorkGroups={setEcnWorkGroups}
          taskRouteTemplates={ecnTaskRouteTemplates}
          setTaskRouteTemplates={setEcnTaskRouteTemplates}
          onAddWorkGroup={handleAddWorkGroup}
          onRemoveWorkGroup={handleRemoveWorkGroup}
          onAddTaskRouteTemplate={handleAddTaskRouteTemplate}
          onRemoveTaskRouteTemplate={handleRemoveTaskRouteTemplate}
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
          } mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:mt-0 lg:h-[calc(100vh-12rem)] lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden ${
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

          <div className="mt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
            <div className="sticky top-0 z-10 border-y border-slate-200/80 bg-white/95 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/95">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile label="Proposed" value={String(proposedCount)} />
                <StatTile label="Started" value={String(startedCount)} />
                <StatTile label="Completed" value={String(completedCount)} />
                <StatTile
                  label={activeLane === "requests" ? "Total Requests" : "Total Notices"}
                  value={String(totalCount)}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
              ecnWorkGroups={ecnWorkGroups}
              ecnTaskRouteTemplates={ecnTaskRouteTemplates}
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
