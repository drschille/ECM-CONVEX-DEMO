import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { startTransition } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "@/lib/convexApi";
import { PageCard } from "./OrgDashboardPage";

const crSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
  changeType: z.enum(["design", "process", "software", "document", "other"]),
  dueDate: z.string(),
  ownerProfileId: z.string(),
  watcherProfileIds: z.array(z.string()),
  affectedItemIds: z.array(z.string()),
});

type CrForm = z.infer<typeof crSchema>;

export function NewChangeRequestPage({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const createCr = useMutation(api.changeRequests.create);
  const items = useQuery(api.items.listForPicker, { organizationId: organizationId as any });
  const members = useQuery(api.organizations.listMembers, { organizationId: organizationId as any });
  const form = useForm<CrForm>({
    resolver: zodResolver(crSchema),
    defaultValues: {
      title: "",
      description: "",
      reason: "",
      priority: "medium",
      changeType: "design",
      dueDate: "",
      ownerProfileId: "",
      watcherProfileIds: [],
      affectedItemIds: [],
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const crId = await createCr({
      organizationId: organizationId as any,
      title: values.title,
      description: values.description,
      reason: values.reason,
      priority: values.priority,
      changeType: values.changeType,
      dueDate: values.dueDate ? new Date(values.dueDate).getTime() : undefined,
      ownerProfileId: values.ownerProfileId ? (values.ownerProfileId as any) : undefined,
      watcherProfileIds: values.watcherProfileIds.map((id: string) => id as any),
      affectedItemIds: values.affectedItemIds.map((id: string) => id as any),
    });
    startTransition(() => {
      void navigate(`/org/${organizationId}/changes/${String(crId)}`);
    });
  });

  return (
    <PageCard subtitle="Create a Change Request (CR) with affected items and ownership." title="New Change Request">
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Title" register={form.register("title")} error={form.formState.errors.title?.message} />
          <SelectField label="Priority" register={form.register("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </SelectField>
          <SelectField label="Change Type" register={form.register("changeType")}>
            <option value="design">Design</option>
            <option value="process">Process</option>
            <option value="software">Software</option>
            <option value="document">Document</option>
            <option value="other">Other</option>
          </SelectField>
          <TextField label="Due Date" register={form.register("dueDate")} type="date" />
          <SelectField label="Owner" register={form.register("ownerProfileId")}>
            <option value="">Unassigned</option>
            {(members ?? []).map((m: any) => (
              <option key={m.profileId} value={m.profileId}>
                {m.name} ({m.role})
              </option>
            ))}
          </SelectField>
        </div>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Description</span>
          <textarea className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("description")} />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Reason</span>
          <textarea className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...form.register("reason")} />
        </label>

        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-600">Watchers</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {(members ?? []).map((m: any) => (
              <label key={`watcher-${m.profileId}`} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={m.profileId} {...form.register("watcherProfileIds")} />
                <span>{m.name}</span>
                <span className="text-xs text-slate-500">({m.role})</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-600">Affected Items</legend>
          <div className="mt-2 grid max-h-56 gap-2 overflow-auto md:grid-cols-2">
            {(items ?? []).map((item: any) => (
              <label key={item._id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                <input className="mt-0.5" type="checkbox" value={item._id} {...form.register("affectedItemIds")} />
                <div>
                  <p className="font-medium text-slate-900">{item.itemNumber}</p>
                  <p className="text-xs text-slate-600">{item.name}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white" type="submit">
            Create CR
          </button>
        </div>
      </form>
    </PageCard>
  );
}

function TextField({
  label,
  register,
  type = "text",
  error,
}: {
  label: string;
  register: any;
  type?: string;
  error?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type={type} {...register} />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </label>
  );
}

function SelectField({
  label,
  register,
  children,
}: {
  label: string;
  register: any;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register}>
        {children}
      </select>
    </label>
  );
}
