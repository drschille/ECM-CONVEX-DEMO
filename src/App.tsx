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
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

  const proposedCount = notices.filter((notice) => notice.state === "proposed").length;
  const startedCount = notices.filter((notice) => notice.state === "started").length;
  const completedCount = notices.filter((notice) => notice.state === "completed").length;
  const selectedNotice = notices.find((notice) => String(notice._id) === selectedNoticeId) ?? null;

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
            onOpen={() => setSelectedNoticeId(String(notice._id))}
          />
        ))}
      </section>

      {selectedNotice && (
        <EcnWorkspace
          notice={selectedNotice}
          onClose={() => setSelectedNoticeId(null)}
        />
      )}

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

function EcnWorkspace({
  notice,
  onClose,
}: {
  notice: {
    _id: unknown;
    id: string;
    state: ChangeNoticeState;
    description: string;
  };
  onClose: () => void;
}) {
  const targets = useQuery(api.changes.changeNoticeTargetsForEcn, {
    changeNoticeId: notice._id as never,
  });
  const suggestions = useQuery(api.changes.impactAnalysisSuggestionsForEcn, {
    changeNoticeId: notice._id as never,
  });
  const links = useQuery(api.changes.changeNoticeLinksForEcn, {
    changeNoticeId: notice._id as never,
  });
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            ECN Workspace
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {notice.id}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notice.description}</p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={onClose}
          type="button"
        >
          Close Workspace
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Product To ECN
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adds the product&apos;s item record as a target on this ECN.
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
        </div>

        <div className="space-y-5">
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

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              PDM Import Placeholder (Vault Push)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use this to simulate a middleware push from Autodesk Vault Professional into products/items.
            </p>
            <textarea
              className="mt-3 min-h-64 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
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

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Linked ECNs</h3>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Parent links: {links?.asParent.length ?? 0}</p>
              <p>Child links: {links?.asChild.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  onOpen,
}: {
  title: string;
  description: string;
  state: ChangeNoticeState;
  author: string;
  timestamp: number;
  isClickable: boolean;
  isBusy: boolean;
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
        <div className="flex items-center gap-2">
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
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${stateLabelClass[state]}`}
          >
            {state}
          </span>
        </div>
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
