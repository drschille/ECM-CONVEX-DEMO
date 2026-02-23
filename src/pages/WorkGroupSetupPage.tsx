import type { Dispatch, SetStateAction } from "react";
import type { EcnTaskRouteTemplate, EcnWorkGroup } from "../features/workspace/types";
import { parseTaskListInput } from "../features/workspace/utils";

export default function WorkGroupSetupPage({
  workGroups,
  setWorkGroups,
  taskRouteTemplates,
  setTaskRouteTemplates,
  onAddWorkGroup,
  onRemoveWorkGroup,
  onAddTaskRouteTemplate,
  onRemoveTaskRouteTemplate,
}: {
  workGroups: EcnWorkGroup[];
  setWorkGroups: Dispatch<SetStateAction<EcnWorkGroup[]>>;
  taskRouteTemplates: EcnTaskRouteTemplate[];
  setTaskRouteTemplates: Dispatch<SetStateAction<EcnTaskRouteTemplate[]>>;
  onAddWorkGroup: () => void;
  onRemoveWorkGroup: (workGroupId: string) => void;
  onAddTaskRouteTemplate: () => void;
  onRemoveTaskRouteTemplate: (templateId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Work Group Setup
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configure ECN work groups, owners, and reusable task-route templates.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Work Groups
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Each work group has an owner and an optional default task route template.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={onAddWorkGroup}
              type="button"
            >
              Add Group
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-300">
                    Work Group
                  </th>
                  <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-300">
                    Owner (User)
                  </th>
                  <th className="px-2 py-2 font-medium text-slate-600 dark:text-slate-300">
                    Default Route
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {workGroups.map((group) => (
                  <tr className="border-b border-slate-100 dark:border-slate-900" key={group.id}>
                    <td className="px-2 py-2 align-top">
                      <input
                        className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        onChange={(e) =>
                          setWorkGroups((current) =>
                            current.map((candidate) =>
                              candidate.id === group.id
                                ? { ...candidate, name: e.target.value }
                                : candidate,
                            ),
                          )
                        }
                        value={group.name}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input
                        className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        onChange={(e) =>
                          setWorkGroups((current) =>
                            current.map((candidate) =>
                              candidate.id === group.id
                                ? { ...candidate, owner: e.target.value }
                                : candidate,
                            ),
                          )
                        }
                        placeholder="user@example.com"
                        value={group.owner}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        onChange={(e) =>
                          setWorkGroups((current) =>
                            current.map((candidate) =>
                              candidate.id === group.id
                                ? { ...candidate, defaultTemplateId: e.target.value }
                                : candidate,
                            ),
                          )
                        }
                        value={group.defaultTemplateId}
                      >
                        <option value="">None</option>
                        {taskRouteTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => onRemoveWorkGroup(group.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {workGroups.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400"
                      colSpan={4}
                    >
                      No work groups defined.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Task Route Templates
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Reusable task sets applied per item/work-group assignment in the ECN matrix.
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={onAddTaskRouteTemplate}
              type="button"
            >
              Add Template
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {taskRouteTemplates.map((template) => (
              <div
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                key={template.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-950"
                    onChange={(e) =>
                      setTaskRouteTemplates((current) =>
                        current.map((candidate) =>
                          candidate.id === template.id
                            ? { ...candidate, name: e.target.value }
                            : candidate,
                        ),
                      )
                    }
                    value={template.name}
                  />
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    onClick={() => onRemoveTaskRouteTemplate(template.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Tasks (comma, semicolon, or newline separated)
                  </span>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    onChange={(e) =>
                      setTaskRouteTemplates((current) =>
                        current.map((candidate) =>
                          candidate.id === template.id
                            ? { ...candidate, tasks: parseTaskListInput(e.target.value) }
                            : candidate,
                        ),
                      )
                    }
                    value={template.tasks.join("\n")}
                  />
                </label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {template.tasks.length} task(s)
                </p>
              </div>
            ))}
            {taskRouteTemplates.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No templates defined.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
