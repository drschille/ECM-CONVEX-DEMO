import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgRole } from "./lib/authz";
import { appendAuditLog, createNotifications } from "./lib/platform";

async function getChangeRequestOrThrow(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  organizationId: any,
  changeRequestId: any,
) {
  const cr = await ctx.db.get(changeRequestId);
  if (!cr || cr.organizationId !== organizationId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Change request not found" });
  }
  return cr;
}

async function computeApprovalSummary(
  ctx: Parameters<typeof query>[0] extends never ? never : any,
  args: { organizationId: any; changeRequestId: any },
) {
  const [policy, approvals] = await Promise.all([
    ctx.db
      .query("approvalPolicies")
      .withIndex("by_org_and_active", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("active", true),
      )
      .unique(),
    ctx.db
      .query("approvals")
      .withIndex("by_org_and_changeRequest", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
      )
      .collect(),
  ]);

  const approverApprovals = approvals.filter((row: any) => row.category === "approver");
  const approvedCount = approverApprovals.filter((row: any) => row.decision === "approved").length;
  const rejectedCount = approvals.filter((row: any) => row.decision === "rejected").length;
  const pendingCount = approvals.filter((row: any) => row.decision === "pending").length;
  const minApproverCount = policy?.minApproverCount ?? 1;
  const extraCategories = policy?.extraSignoffCategories ?? [];
  const categoryStatus = extraCategories.map((category: string) => ({
    category,
    approved: approvals.some((row: any) => row.category === category && row.decision === "approved"),
    rejected: approvals.some((row: any) => row.category === category && row.decision === "rejected"),
    pending: !approvals.some((row: any) => row.category === category && row.decision !== "pending"),
  }));

  return {
    minApproverCount,
    approvedCount,
    rejectedCount,
    pendingCount,
    categoryStatus,
    policySatisfied:
      approvedCount >= minApproverCount &&
      rejectedCount === 0 &&
      categoryStatus.every((status: any) => status.approved),
  };
}

export const listForChangeRequest = query({
  args: { organizationId: v.id("organizations"), changeRequestId: v.id("changeRequests") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    return await ctx.db
      .query("approvals")
      .withIndex("by_org_and_changeRequest", (q) =>
        q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
      )
      .collect();
  },
});

export const approvalSummary = query({
  args: { organizationId: v.id("organizations"), changeRequestId: v.id("changeRequests") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    return await computeApprovalSummary(ctx, args);
  },
});

export const decide = mutation({
  args: {
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    comment: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { actor, membership } = await requireOrgRole(ctx, args.organizationId, ["admin", "approver"]);
    const cr = await getChangeRequestOrThrow(ctx, args.organizationId, args.changeRequestId);
    if (!["in_review", "approved", "implementing", "verified"].includes(cr.status)) {
      throw new ConvexError({
        code: "VALIDATION",
        message: `Cannot record approvals while CR is ${cr.status}`,
      });
    }

    const category = (args.category?.trim() || "approver").toLowerCase();
    if (category === "approver" && membership.role !== "approver" && membership.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only approvers/admins can sign off" });
    }

    const existing = await ctx.db
      .query("approvals")
      .withIndex("by_changeRequest_and_profile", (q) =>
        q.eq("changeRequestId", args.changeRequestId).eq("profileId", actor.profile._id),
      )
      .collect();
    const target = existing.find((row) => row.category === category);
    const now = Date.now();

    if (target) {
      await ctx.db.patch("approvals", target._id, {
        decision: args.decision,
        comment: args.comment?.trim(),
        decidedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("approvals", {
        organizationId: args.organizationId,
        changeRequestId: args.changeRequestId,
        profileId: actor.profile._id,
        category,
        decision: args.decision,
        comment: args.comment?.trim(),
        decidedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "approval",
      entityId: `${String(args.changeRequestId)}:${String(actor.profile._id)}:${category}`,
      action: "approval_decision_recorded",
      actorProfileId: actor.profile._id,
      comment: args.comment,
      metadata: { decision: args.decision, category, crNumber: cr.crNumber },
    });

    const notifyIds = [cr.ownerProfileId, cr.createdByProfileId, ...cr.watcherProfileIds].filter(
      (id): id is typeof actor.profile._id => Boolean(id),
    );
    await createNotifications(ctx, {
      organizationId: args.organizationId,
      recipientProfileIds: notifyIds,
      type: "approval_decision",
      title: `${cr.crNumber} ${args.decision} (${category})`,
      body: args.comment?.trim() || actor.profile.name,
      relatedEntityType: "changeRequest",
      relatedEntityId: String(cr._id),
    });

    return await computeApprovalSummary(ctx, {
      organizationId: args.organizationId,
      changeRequestId: args.changeRequestId,
    });
  },
});
