import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/convexApi";
import { PageCard } from "./OrgDashboardPage";

type PolicyForm = { minApproverCount: number; extraSignoffCategories: string };
type CreateOrgForm = { name: string; slug: string; description: string };
type AddMemberForm = { email: string; name: string; role: "admin" | "engineer" | "approver" | "viewer" };

export function SettingsPage({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const org = useQuery(api.organizations.get, { organizationId: organizationId as any });
  const members = useQuery(api.organizations.listMembers, { organizationId: organizationId as any });
  const policy = useQuery(api.organizations.getApprovalPolicy, { organizationId: organizationId as any });
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);
  const createOrganization = useMutation(api.organizations.create);
  const addMemberByEmail = useMutation(api.organizations.addMemberByEmail);
  const upsertApprovalPolicy = useMutation(api.organizations.upsertApprovalPolicy);
  const seedDemoData = useMutation(api.devSeed.seedDemoData);
  const [orgSetup, setOrgSetup] = useState<{ busy: boolean; message?: string; error?: string }>({
    busy: false,
  });
  const [memberSetup, setMemberSetup] = useState<{
    busy: boolean;
    message?: string;
    error?: string;
  }>({ busy: false });
  const [seedState, setSeedState] = useState<{
    status: "idle" | "running" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const form = useForm<PolicyForm>({
    defaultValues: { minApproverCount: 1, extraSignoffCategories: "" },
  });
  const createOrgForm = useForm<CreateOrgForm>({
    defaultValues: { name: "", slug: "", description: "" },
  });
  const addMemberForm = useForm<AddMemberForm>({
    defaultValues: { email: "", name: "", role: "engineer" },
  });

  useEffect(() => {
    if (!policy) return;
    form.reset({
      minApproverCount: policy.minApproverCount,
      extraSignoffCategories: (policy.extraSignoffCategories ?? []).join(", "),
    });
  }, [form, policy]);

  const isAdmin = org?.myRole === "admin";
  const canSeed = import.meta.env.DEV && isAdmin;

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
        {import.meta.env.DEV && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Dev Seed
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Populate this organization with sample items, CRs, approvals, and audit events.
                </p>
              </div>
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!canSeed || seedState.status === "running"}
                onClick={() => {
                  if (!canSeed) return;
                  setSeedState({ status: "running" });
                  void (async () => {
                    try {
                      const result = await seedDemoData({
                        organizationId: organizationId as any,
                      });
                      if (result?.skipped) {
                        setSeedState({
                          status: "success",
                          message: `Skipped: ${result.reason ?? "organization already seeded"}`,
                        });
                        return;
                      }
                      setSeedState({
                        status: "success",
                        message: `Seeded ${result?.createdItemCount ?? 0} items and ${result?.createdChangeRequestCount ?? 0} change requests.`,
                      });
                    } catch (error) {
                      setSeedState({
                        status: "error",
                        message: error instanceof Error ? error.message : "Seed failed",
                      });
                    }
                  })();
                }}
                type="button"
              >
                {seedState.status === "running" ? "Seeding..." : "Seed Demo Data"}
              </button>
            </div>
            {seedState.message && (
              <p
                className={`mt-2 text-xs ${
                  seedState.status === "error" ? "text-rose-700" : "text-slate-600"
                }`}
              >
                {seedState.message}
              </p>
            )}
            {!isAdmin && (
              <p className="mt-2 text-xs text-amber-700">
                Requires admin role to run in the UI.
              </p>
            )}
          </div>
        )}
      </PageCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageCard title="Organization Setup">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              void createOrgForm.handleSubmit(async (values) => {
                if (!isAdmin) return;
                setOrgSetup({ busy: true });
                try {
                  const orgId = await createOrganization({
                    name: values.name.trim(),
                    slug: values.slug.trim(),
                    description: values.description.trim() || undefined,
                  });
                  setOrgSetup({
                    busy: false,
                    message: `Created organization ${values.name}. Redirecting...`,
                  });
                  createOrgForm.reset();
                  void navigate(`/org/${String(orgId)}/dashboard`);
                } catch (error) {
                  setOrgSetup({
                    busy: false,
                    error: error instanceof Error ? error.message : "Failed to create organization",
                  });
                }
              })(e);
            }}
          >
            <p className="text-xs text-slate-600">
              Create additional organizations/workspaces. You will be added as an admin.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Name
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || orgSetup.busy}
                placeholder="Acme Robotics"
                {...createOrgForm.register("name", { required: true })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Slug
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || orgSetup.busy}
                placeholder="acme-robotics"
                {...createOrgForm.register("slug", { required: true })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Description
              </span>
              <textarea
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || orgSetup.busy}
                placeholder="Optional"
                {...createOrgForm.register("description")}
              />
            </label>
            {(orgSetup.message || orgSetup.error) && (
              <p className={`text-xs ${orgSetup.error ? "text-rose-700" : "text-slate-600"}`}>
                {orgSetup.error ?? orgSetup.message}
              </p>
            )}
            <div className="flex justify-end">
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!isAdmin || orgSetup.busy}
                type="submit"
              >
                {orgSetup.busy ? "Creating..." : "Create Organization"}
              </button>
            </div>
          </form>
        </PageCard>

        <PageCard title="Members">
          <form
            className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            onSubmit={(e) => {
              void addMemberForm.handleSubmit(async (values) => {
                if (!isAdmin) return;
                setMemberSetup({ busy: true });
                try {
                  const result = await addMemberByEmail({
                    organizationId: organizationId as any,
                    email: values.email.trim(),
                    name: values.name.trim() || undefined,
                    role: values.role,
                  });
                  setMemberSetup({
                    busy: false,
                    message: result.created
                      ? `Added ${result.email} as ${result.role}`
                      : `Updated ${result.email} to ${result.role}`,
                  });
                  addMemberForm.reset({ email: "", name: "", role: "engineer" });
                } catch (error) {
                  setMemberSetup({
                    busy: false,
                    error: error instanceof Error ? error.message : "Failed to add member",
                  });
                }
              })(e);
            }}
          >
            <p className="mb-2 text-xs text-slate-600">
              Add an existing user by email, or pre-provision a profile before they sign in.
            </p>
            <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_0.9fr_auto]">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || memberSetup.busy}
                placeholder="user@company.com"
                type="email"
                {...addMemberForm.register("email", { required: true })}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || memberSetup.busy}
                placeholder="Optional name"
                {...addMemberForm.register("name")}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!isAdmin || memberSetup.busy}
                {...addMemberForm.register("role")}
              >
                <option value="admin">Admin</option>
                <option value="engineer">Engineer</option>
                <option value="approver">Approver</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!isAdmin || memberSetup.busy}
                type="submit"
              >
                {memberSetup.busy ? "Adding..." : "Add"}
              </button>
            </div>
            {(memberSetup.message || memberSetup.error) && (
              <p className={`mt-2 text-xs ${memberSetup.error ? "text-rose-700" : "text-slate-600"}`}>
                {memberSetup.error ?? memberSetup.message}
              </p>
            )}
          </form>
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
