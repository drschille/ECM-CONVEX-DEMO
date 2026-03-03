import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { EcnTaskRouteTemplate, EcnWorkGroup } from "./types";
import { parseTaskListInput } from "./utils";

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
  const persistedEcnRoutingMatrix = useQuery(
    api.changes.changeNoticeRoutingMatrix,
    !isEcrWorkspace ? { changeNoticeId: notice._id as never } : "skip",
  );
  const items = useQuery(api.products.listItems, {}) ?? [];
  const products = useQuery(api.products.listProducts, {}) ?? [];

  const addTarget = useMutation(api.changes.addChangeNoticeTarget);
  const runImpactAnalysis = useMutation(api.changes.runImpactAnalysisForEcn);
  const acceptFollowUp = useMutation(api.changes.acceptSuggestionCreateFollowUpEcn);
  const importPdmProduct = useMutation(api.products.importProductBomFromPdmPlaceholder);
  const ensureProductForRouting = useMutation(api.products.ensureProductForRouting);
  const addChangeNoticeRoutingItem = useMutation(api.changes.addChangeNoticeRoutingItem);
  const removeChangeNoticeRoutingItem = useMutation(api.changes.removeChangeNoticeRoutingItem);
  const setChangeNoticeRoutingAssignment = useMutation(api.changes.setChangeNoticeRoutingAssignment);

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
  const [routingProductNumber, setRoutingProductNumber] = useState("");
  const [isCreateRoutingProductOpen, setIsCreateRoutingProductOpen] = useState(false);
  const [createRoutingProductDraft, setCreateRoutingProductDraft] = useState({
    productNumber: "",
    drawingNumber: "",
    revision: "",
    name: "",
    description: "",
  });
  const [createRoutingProductError, setCreateRoutingProductError] = useState<string | null>(null);
  const [isCreatingRoutingProduct, setIsCreatingRoutingProduct] = useState(false);

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
  const getTaskRouteTemplate = (templateId: string) =>
    ecnTaskRouteTemplates.find((template) => template.id === templateId) ?? null;

  const getEcnAssignment = (itemId: string, workGroupId: string) =>
    persistedEcnRoutingMatrix?.assignmentByRowAndGroup?.[`${itemId}:${workGroupId}`] ?? {
      required: false,
      templateId: "",
      tasks: [],
    };

  const addRoutingRowByItemId = async (itemId: string) => {
    await addChangeNoticeRoutingItem({
      changeNoticeId: notice._id as never,
      itemId: itemId as never,
    });
  };

  const handleAddEcnRoutingRow = async () => {
    const normalizedProductNumber = routingProductNumber.trim().toUpperCase();
    if (!normalizedProductNumber) {
      return;
    }

    const existingProduct = products.find(
      (candidate) => candidate.productNumber.trim().toUpperCase() === normalizedProductNumber,
    );

    try {
      if (existingProduct) {
        const productItem = items.find(
          (candidate) =>
            candidate.itemType === "product" &&
            candidate.partNumber.trim().toUpperCase() === normalizedProductNumber,
        );
        if (productItem) {
          await addRoutingRowByItemId(String(productItem._id));
          setRoutingProductNumber("");
          return;
        }

        const ensured = await ensureProductForRouting({
          productNumber: existingProduct.productNumber,
          drawingNumber: existingProduct.drawingNumber,
          revision: existingProduct.revision,
          name: existingProduct.name,
          description: undefined,
        });
        await addRoutingRowByItemId(String(ensured.itemId));
        setRoutingProductNumber("");
        return;
      }

      setCreateRoutingProductDraft({
        productNumber: normalizedProductNumber,
        drawingNumber: "",
        revision: "",
        name: normalizedProductNumber,
        description: "",
      });
      setCreateRoutingProductError(null);
      setIsCreateRoutingProductOpen(true);
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : "Failed to add routing row.");
    }
  };

  const handleCreateRoutingProduct = async () => {
    const productNumber = createRoutingProductDraft.productNumber.trim().toUpperCase();
    const drawingNumber = createRoutingProductDraft.drawingNumber.trim();
    const revision = createRoutingProductDraft.revision.trim();
    const name = createRoutingProductDraft.name.trim();

    if (!productNumber || !drawingNumber || !revision || !name) {
      setCreateRoutingProductError("Product number, drawing number, revision, and name are required.");
      return;
    }

    setCreateRoutingProductError(null);
    setIsCreatingRoutingProduct(true);
    try {
      const ensured = await ensureProductForRouting({
        productNumber,
        drawingNumber,
        revision,
        name,
        description: createRoutingProductDraft.description.trim() || undefined,
      });
      await addRoutingRowByItemId(String(ensured.itemId));
      setRoutingProductNumber("");
      setIsCreateRoutingProductOpen(false);
      setAnalysisStatus(
        ensured.created
          ? `Created product ${productNumber} and added it to routing.`
          : `Added ${productNumber} to routing.`,
      );
    } catch (error) {
      setCreateRoutingProductError(
        error instanceof Error ? error.message : "Failed to create product.",
      );
    } finally {
      setIsCreatingRoutingProduct(false);
    }
  };

  const handleRemoveEcnRoutingRow = async (itemId: string) => {
    try {
      await removeChangeNoticeRoutingItem({
        changeNoticeId: notice._id as never,
        itemId: itemId as never,
      });
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : "Failed to remove routing row.");
    }
  };

  const saveRoutingAssignment = async (
    itemId: string,
    group: EcnWorkGroup,
    next: { required: boolean; templateId: string; tasks: string[] },
  ) => {
    try {
      await setChangeNoticeRoutingAssignment({
        changeNoticeId: notice._id as never,
        itemId: itemId as never,
        workGroupId: group.id,
        workGroupName: group.name || undefined,
        workGroupOwner: group.owner || undefined,
        required: next.required,
        templateId: next.templateId || undefined,
        tasks: next.tasks,
      });
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : "Failed to save assignment.");
    }
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
            Persisted data: rows and task assignments are saved per ECN and loaded when reopened.
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-slate-700 dark:text-slate-200">
                Add product row by product number
              </span>
              <input
                className="w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) => setRoutingProductNumber(e.target.value)}
                placeholder="e.g. ASM-1000"
                value={routingProductNumber}
              />
            </label>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              onClick={() => void handleAddEcnRoutingRow()}
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
                      className="h-44 min-w-14 border border-slate-200 bg-slate-100 px-2 py-2 align-bottom font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      key={group.id}
                    >
                      <div
                        className="[text-orientation:mixed] mx-auto flex h-full flex-col items-center justify-end gap-1 whitespace-nowrap [writing-mode:vertical-rl]"
                        title={`${group.name || "Unnamed group"} - Owner: ${group.owner || "Unassigned"}`}
                      >
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
                {(persistedEcnRoutingMatrix?.rows.length ?? 0) === 0 && (
                  <tr>
                    <td
                      className="border border-slate-200 px-3 py-4 text-slate-500 dark:border-slate-800 dark:text-slate-400"
                      colSpan={Math.max(1, ecnWorkGroups.length + 1)}
                    >
                      No rows yet. Add a part or product to build the routing matrix.
                    </td>
                  </tr>
                )}
                {(persistedEcnRoutingMatrix?.rows ?? []).map((row) => (
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
                          onClick={() => void handleRemoveEcnRoutingRow(row.itemId)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                    {ecnWorkGroups.map((group) => {
                      const assignment = getEcnAssignment(row.itemId, group.id);
                      return (
                        <td
                          className="border border-slate-200 px-3 py-2 align-top dark:border-slate-800"
                          key={`${row.id}-${group.id}`}
                        >
                          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <input
                              checked={assignment.required}
                              onChange={(e) => void (async () => {
                                const checked = e.target.checked;
                                if (!checked) {
                                  await saveRoutingAssignment(row.itemId, group, {
                                    required: false,
                                    templateId: "",
                                    tasks: [],
                                  });
                                  return;
                                }
                                if (assignment.templateId || assignment.tasks.length > 0) {
                                  await saveRoutingAssignment(row.itemId, group, {
                                    ...assignment,
                                    required: true,
                                  });
                                  return;
                                }
                                const templateId = group.defaultTemplateId;
                                const template = templateId
                                  ? getTaskRouteTemplate(templateId)
                                  : null;
                                await saveRoutingAssignment(row.itemId, group, {
                                  required: true,
                                  templateId: template?.id ?? "",
                                  tasks: template?.tasks ?? [],
                                });
                              })()}
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
                              onChange={(e) => void (async () => {
                                const templateId = e.target.value;
                                const template = getTaskRouteTemplate(templateId);
                                await saveRoutingAssignment(row.itemId, group, {
                                  required: assignment.required,
                                  templateId,
                                  tasks: template ? [...template.tasks] : assignment.tasks,
                                });
                              })()}
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
                              defaultValue={assignment.tasks.join(", ")}
                              key={`${row.id}-${group.id}-${assignment.tasks.join("|")}`}
                              onBlur={(e) =>
                                void saveRoutingAssignment(row.itemId, group, {
                                  required: assignment.required,
                                  templateId: assignment.templateId,
                                  tasks: parseTaskListInput(e.target.value),
                                })
                              }
                              placeholder="e.g. Review drawing, Approve"
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

    {isCreateRoutingProductOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        onClick={() => setIsCreateRoutingProductOpen(false)}
        role="presentation"
      >
        <div
          className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-routing-product-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                id="create-routing-product-title"
              >
                Create Product
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Product not found. Fill in the product data to add it to this change notice.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setIsCreateRoutingProductOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-slate-200">Product number</span>
              <input
                className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) =>
                  setCreateRoutingProductDraft((current) => ({
                    ...current,
                    productNumber: e.target.value,
                  }))
                }
                value={createRoutingProductDraft.productNumber}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-200">Drawing number</span>
              <input
                className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) =>
                  setCreateRoutingProductDraft((current) => ({
                    ...current,
                    drawingNumber: e.target.value,
                  }))
                }
                value={createRoutingProductDraft.drawingNumber}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-200">Revision</span>
              <input
                className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) =>
                  setCreateRoutingProductDraft((current) => ({
                    ...current,
                    revision: e.target.value,
                  }))
                }
                value={createRoutingProductDraft.revision}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-slate-200">Name</span>
              <input
                className="rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) =>
                  setCreateRoutingProductDraft((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                value={createRoutingProductDraft.name}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-slate-200">Description (optional)</span>
              <textarea
                className="min-h-24 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) =>
                  setCreateRoutingProductDraft((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                value={createRoutingProductDraft.description}
              />
            </label>
          </div>

          {createRoutingProductError && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">{createRoutingProductError}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setIsCreateRoutingProductOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              disabled={isCreatingRoutingProduct}
              onClick={() => void handleCreateRoutingProduct()}
              type="button"
            >
              {isCreatingRoutingProduct ? "Creating..." : "Create Product + Add Row"}
            </button>
          </div>
        </div>
      </div>
    )}

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
