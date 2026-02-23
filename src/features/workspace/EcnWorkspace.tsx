import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type {
  EcnRoutingRow,
  EcnTaskRouteTemplate,
  EcnWorkGroup,
  EcnWorkGroupAssignment,
} from "./types";
import { makeLocalId, parseTaskListInput } from "./utils";

type ChangeNoticeState = "proposed" | "started" | "completed" | "cancelled";

export default function EcnWorkspace({
  notice,
  workspaceKind,
  ecnWorkGroups,
  ecnTaskRouteTemplates,
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
  ecnWorkGroups: EcnWorkGroup[];
  ecnTaskRouteTemplates: EcnTaskRouteTemplate[];
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
  const [ecnRoutingRows, setEcnRoutingRows] = useState<EcnRoutingRow[]>([]);
  const [selectedEcnRoutingItemId, setSelectedEcnRoutingItemId] = useState("");
  const [ecnAssignments, setEcnAssignments] = useState<
    Record<string, Record<string, EcnWorkGroupAssignment>>
  >({});

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
  const ecnAssignableItems = items
    .slice()
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  const getTaskRouteTemplate = (templateId: string) =>
    ecnTaskRouteTemplates.find((template) => template.id === templateId) ?? null;

  const getEcnAssignment = (rowId: string, workGroupId: string): EcnWorkGroupAssignment =>
    ecnAssignments[rowId]?.[workGroupId] ?? { required: false, templateId: "", tasks: [] };

  const updateEcnAssignment = (
    rowId: string,
    workGroupId: string,
    updater: (current: EcnWorkGroupAssignment) => EcnWorkGroupAssignment,
  ) => {
    setEcnAssignments((current) => {
      const rowAssignments = current[rowId] ?? {};
      const nextCell = updater(rowAssignments[workGroupId] ?? { required: false, templateId: "", tasks: [] });
      return {
        ...current,
        [rowId]: {
          ...rowAssignments,
          [workGroupId]: nextCell,
        },
      };
    });
  };

  const handleAddEcnRoutingRow = () => {
    if (!selectedEcnRoutingItemId) {
      return;
    }
    const item = items.find((candidate) => String(candidate._id) === selectedEcnRoutingItemId);
    if (!item) {
      return;
    }
    setEcnRoutingRows((current) => {
      if (current.some((row) => row.itemId === selectedEcnRoutingItemId)) {
        return current;
      }
      return [
        ...current,
        {
          id: makeLocalId("row"),
          itemId: String(item._id),
          partNumber: item.partNumber,
          name: item.name,
          itemType: item.itemType,
        },
      ];
    });
    setSelectedEcnRoutingItemId("");
  };

  const handleRemoveEcnRoutingRow = (rowId: string) => {
    setEcnRoutingRows((current) => current.filter((row) => row.id !== rowId));
    setEcnAssignments((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

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
            className="hidden items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:inline-flex"
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

      {!isEcrWorkspace && (
        <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            ECN Work Group Routing Matrix
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Assign each affected part/product to the work groups that must handle it. Tasks can be
            templated, then adjusted per item.
          </p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/10 dark:text-amber-100">
            Prototype UI only: work groups, templates, and routing assignments are currently local
            to this workspace view and not persisted yet.
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-slate-700 dark:text-slate-200">
                Add part/product row
              </span>
              <select
                className="w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) => setSelectedEcnRoutingItemId(e.target.value)}
                value={selectedEcnRoutingItemId}
              >
                <option value="">Select item...</option>
                {ecnAssignableItems.map((item) => (
                  <option key={String(item._id)} value={String(item._id)}>
                    {item.partNumber} - {item.name} ({item.itemType})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              onClick={handleAddEcnRoutingRow}
              type="button"
            >
              Add Row
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-64 border border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    Part / Product
                  </th>
                  {ecnWorkGroups.map((group) => (
                    <th
                      className="min-w-64 border border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      key={group.id}
                    >
                      <div className="flex flex-col">
                        <span>{group.name || "Unnamed group"}</span>
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          Owner: {group.owner || "Unassigned"}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ecnRoutingRows.length === 0 && (
                  <tr>
                    <td
                      className="border border-slate-200 px-3 py-4 text-slate-500 dark:border-slate-800 dark:text-slate-400"
                      colSpan={Math.max(1, ecnWorkGroups.length + 1)}
                    >
                      No rows yet. Add a part or product to build the routing matrix.
                    </td>
                  </tr>
                )}
                {ecnRoutingRows.map((row) => (
                  <tr key={row.id}>
                    <td className="sticky left-0 z-[1] border border-slate-200 bg-white px-3 py-2 align-top dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.partNumber}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">{row.name}</p>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {row.itemType}
                          </p>
                        </div>
                        <button
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                          onClick={() => handleRemoveEcnRoutingRow(row.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                    {ecnWorkGroups.map((group) => {
                      const assignment = getEcnAssignment(row.id, group.id);
                      return (
                        <td
                          className="border border-slate-200 px-3 py-2 align-top dark:border-slate-800"
                          key={`${row.id}-${group.id}`}
                        >
                          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <input
                              checked={assignment.required}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateEcnAssignment(row.id, group.id, (current) => {
                                  if (!checked) {
                                    return { ...current, required: false };
                                  }
                                  if (current.templateId || current.tasks.length > 0) {
                                    return { ...current, required: true };
                                  }
                                  const templateId = group.defaultTemplateId;
                                  const template = templateId
                                    ? getTaskRouteTemplate(templateId)
                                    : null;
                                  return {
                                    required: true,
                                    templateId: template?.id ?? "",
                                    tasks: template?.tasks ?? [],
                                  };
                                });
                              }}
                              type="checkbox"
                            />
                            Required
                          </label>

                          <label className="mt-2 block">
                            <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Template
                            </span>
                            <select
                              className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                              disabled={!assignment.required}
                              onChange={(e) => {
                                const templateId = e.target.value;
                                updateEcnAssignment(row.id, group.id, (current) => {
                                  const template = getTaskRouteTemplate(templateId);
                                  return {
                                    ...current,
                                    required: current.required,
                                    templateId,
                                    tasks: template ? [...template.tasks] : current.tasks,
                                  };
                                });
                              }}
                              value={assignment.templateId}
                            >
                              <option value="">None</option>
                              {ecnTaskRouteTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="mt-2 block">
                            <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Tasks (comma-separated)
                            </span>
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                              disabled={!assignment.required}
                              onChange={(e) =>
                                updateEcnAssignment(row.id, group.id, (current) => ({
                                  ...current,
                                  tasks: parseTaskListInput(e.target.value),
                                }))
                              }
                              placeholder="e.g. Review drawing, Approve"
                              value={assignment.tasks.join(", ")}
                            />
                          </label>

                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {assignment.required
                              ? `${assignment.tasks.length} task(s)`
                              : "Not required"}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
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
