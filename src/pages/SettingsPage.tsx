import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/convexApi";
import { PageCard } from "./OrgDashboardPage";

type PolicyForm = { minApproverCount: number; extraSignoffCategories: string };

export function SettingsPage({ organizationId }: { organizationId: string }) {
  const org = useQuery(api.organizations.get, { organizationId: organizationId as any });
  const members = useQuery(api.organizations.listMembers, { organizationId: organizationId as any });
  const policy = useQuery(api.organizations.getApprovalPolicy, { organizationId: organizationId as any });
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);
  const upsertApprovalPolicy = useMutation(api.organizations.upsertApprovalPolicy);
  const form = useForm<PolicyForm>({
    defaultValues: { minApproverCount: 1, extraSignoffCategories: "" },
  });

  useEffect(() => {
    if (!policy) return;
    form.reset({
      minApproverCount: policy.minApproverCount,
      extraSignoffCategories: (policy.extraSignoffCategories ?? []).join(", "),
    });
  }, [form, policy]);

  const isAdmin = org?.myRole === "admin";

  return (
    <div className="space-y-4">
      <PageCard subtitle="Organization membership and approval policy configuration." title="Settings">
        <p className="text-sm text-slate-600">
          Current role: <span className="font-semibold text-slate-900">{org?.myRole ?? "Loading..."}</span>
        </p>
        {!isAdmin && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Admin-only controls are disabled for your role.
          </p>
        )}
      </PageCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageCard title="Members">
          <div className="space-y-2">
            {(members ?? []).map((member: any) => (
              <div key={member.membershipId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-600">{member.email}</p>
                </div>
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  defaultValue={member.role}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    void updateMemberRole({
                      organizationId: organizationId as any,
                      membershipId: member.membershipId,
                      role: e.target.value as any,
                    });
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="engineer">Engineer</option>
                  <option value="approver">Approver</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Approval Policy">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              void form.handleSubmit(async (values) => {
                if (!isAdmin) return;
                await upsertApprovalPolicy({
                  organizationId: organizationId as any,
                  minApproverCount: Number(values.minApproverCount),
                  extraSignoffCategories: values.extraSignoffCategories
                    .split(/[;,]/)
                    .map((c) => c.trim())
                    .filter(Boolean),
                });
              })(e);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Minimum Approver Count
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin}
                type="number"
                min={1}
                {...form.register("minApproverCount", { valueAsNumber: true })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Extra Signoff Categories
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin}
                placeholder="QA, Manufacturing"
                {...form.register("extraSignoffCategories")}
              />
            </label>
            <div className="flex justify-end">
              <button className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={!isAdmin} type="submit">
                Save Policy
              </button>
            </div>
          </form>
        </PageCard>
      </div>
    </div>
  );
}
