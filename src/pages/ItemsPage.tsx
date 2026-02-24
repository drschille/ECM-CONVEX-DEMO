import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";
import { PageCard } from "./OrgDashboardPage";

const itemSchema = z.object({
  itemNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  revision: z.string().min(1),
  lifecycleState: z.enum(["draft", "released", "obsolete"]),
  tags: z.string(),
});

type ItemForm = z.infer<typeof itemSchema>;

export function ItemsPage({ organizationId }: { organizationId: string }) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const items = useQuery(api.items.list, {
    organizationId: organizationId as any,
    search: search || undefined,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const imports = useQuery(api.items.listImports, {
    organizationId: organizationId as any,
    paginationOpts: { numItems: 10, cursor: null },
  });
  const createItem = useMutation(api.items.create);
  const updateItem = useMutation(api.items.update);
  const importCsv = useAction(api.itemImports.importItemsCsv);

  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemNumber: "",
      name: "",
      description: "",
      revision: "A",
      lifecycleState: "draft",
      tags: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const tags = values.tags
      .split(/[;,]/)
      .map((tag: string) => tag.trim())
      .filter(Boolean);
    if (editingId) {
      await updateItem({
        organizationId: organizationId as any,
        itemId: editingId as any,
        name: values.name,
        description: values.description,
        revision: values.revision,
        lifecycleState: values.lifecycleState,
        tags,
      });
    } else {
      await createItem({
        organizationId: organizationId as any,
        itemNumber: values.itemNumber,
        name: values.name,
        description: values.description,
        revision: values.revision,
        lifecycleState: values.lifecycleState,
        tags,
      });
    }
    form.reset({ itemNumber: "", name: "", description: "", revision: "A", lifecycleState: "draft", tags: "" });
    setEditingId(null);
  });

  const startEdit = (item: any) => {
    setEditingId(item._id);
    form.reset({
      itemNumber: item.itemNumber,
      name: item.name,
      description: item.description,
      revision: item.revision,
      lifecycleState: item.lifecycleState,
      tags: item.tags.join(", "),
    });
  };

  const handleCsv = async (file?: File) => {
    if (!file) return;
    const csvText = await file.text();
    await importCsv({
      organizationId: organizationId as any,
      fileName: file.name,
      csvText,
    });
  };

  return (
    <div className="space-y-4">
      <PageCard
        action={
          <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Import CSV
            <input className="hidden" onChange={(e) => void handleCsv(e.target.files?.[0])} type="file" accept=".csv" />
          </label>
        }
        subtitle="Create, search, edit, and import items/parts/documents."
        title="Items Registry"
      >
        <div className="mb-4 flex gap-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item number, name, description, tags..."
            value={search}
          />
        </div>
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Revision</th>
                <th className="px-3 py-2">Lifecycle</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(items?.page ?? []).map((item: any) => (
                <tr key={item._id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{item.itemNumber}</p>
                    <p className="text-xs text-slate-600">{item.name}</p>
                  </td>
                  <td className="px-3 py-2">{item.revision}</td>
                  <td className="px-3 py-2 capitalize">{item.lifecycleState}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(item.updatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="text-xs text-teal-700 hover:underline" onClick={() => startEdit(item)} type="button">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {(items?.page ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-5 text-sm text-slate-500" colSpan={5}>
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageCard>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <PageCard title={editingId ? "Edit Item" : "Create Item"}>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void submit(e)}>
            <Field label="Item Number" disabled={Boolean(editingId)} error={form.formState.errors.itemNumber?.message}>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("itemNumber")} />
            </Field>
            <Field label="Revision" error={form.formState.errors.revision?.message}>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("revision")} />
            </Field>
            <Field className="md:col-span-2" label="Name" error={form.formState.errors.name?.message}>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("name")} />
            </Field>
            <Field className="md:col-span-2" label="Description">
              <textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("description")} />
            </Field>
            <Field label="Lifecycle">
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("lifecycleState")}>
                <option value="draft">Draft</option>
                <option value="released">Released</option>
                <option value="obsolete">Obsolete</option>
              </select>
            </Field>
            <Field label="Tags">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="comma,separated" {...form.register("tags")} />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId && (
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingId(null);
                    form.reset();
                  }}
                  type="button"
                >
                  Cancel
                </button>
              )}
              <button className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white" type="submit">
                {editingId ? "Save Changes" : "Create Item"}
              </button>
            </div>
          </form>
        </PageCard>

        <PageCard title="Recent Imports">
          <div className="space-y-2">
            {(imports?.page ?? []).map((imp: any) => (
              <div key={imp._id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-medium text-slate-900">{imp.fileName}</p>
                <p className="mt-1 text-slate-600">
                  Inserted {imp.insertedCount}, updated {imp.updatedCount}, errors {imp.errorCount}
                </p>
                <p className="mt-1 text-slate-500">{fmtDate(imp.createdAt)}</p>
                {imp.errors?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-slate-700">Show errors</summary>
                    <ul className="mt-1 space-y-1">
                      {imp.errors.slice(0, 5).map((err: any, idx: number) => (
                        <li key={idx} className="text-rose-700">
                          Row {err.rowNumber}: {err.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {(imports?.page ?? []).length === 0 && <p className="text-sm text-slate-500">No imports yet.</p>}
          </div>
        </PageCard>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  className,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={className}>
      <span className={`mb-1 block text-xs font-medium uppercase tracking-wide ${disabled ? "text-slate-400" : "text-slate-600"}`}>
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </label>
  );
}
