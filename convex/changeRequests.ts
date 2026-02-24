import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgRole } from "./lib/authz";
import { canTransitionStatus, computeStatusSlaDueAt, isTerminalStatus } from "./lib/domain";
import {
  appendAuditLog,
  applyEcoClosureToItems,
  createNotifications,
  ensureEcoForChangeRequest,
  formatSequence,
  nextCounterValue,
  updateStatusTimestamps,
} from "./lib/platform";

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(10000),
  reason: z.string().trim().min(1).max(4000),
  priority: z.enum(["low", "medium", "high", "critical"]),
  changeType: z.enum(["design", "process", "software", "document", "other"]),
  dueDate: z.number().int().positive().optional(),
  ownerProfileId: z.string().optional(),
  watcherProfileIds: z.array(z.string()).max(50).default([]),
  affectedItemIds: z.array(z.string()).max(200).default([]),
});

const updateSchema = createSchema.partial().omit({ affectedItemIds: true }).extend({
  affectedItemIds: z.array(z.string()).max(200).optional(),
});

async function ensureCrInOrg(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  organizationId: Id<"organizations">,
  changeRequestId: Id<"changeRequests">,
) {
  const changeRequest = (await ctx.db.get(changeRequestId)) as Doc<"changeRequests"> | null;
  if (!changeRequest || changeRequest.organizationId !== organizationId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Change request not found" });
  }
  return changeRequest;
}

async function replaceAffectedItems(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  args: {
    organizationId: Id<"organizations">;
    changeRequestId: Id<"changeRequests">;
    affectedItemIds: Id<"items">[];
  },
) {
  const existingLinks = await ctx.db
    .query("changeRequestItems")
    .withIndex("by_org_and_changeRequest", (q: any) =>
      q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
    )
    .collect();
  for (const link of existingLinks) {
    await ctx.db.delete("changeRequestItems", link._id);
  }

  const seen = new Set<string>();
  for (const itemId of args.affectedItemIds) {
    if (seen.has(String(itemId))) continue;
    seen.add(String(itemId));
    const item = await ctx.db.get(itemId);
    if (!item || item.organizationId !== args.organizationId) {
      throw new ConvexError({
        code: "VALIDATION",
        message: `Affected item ${String(itemId)} is invalid for this organization`,
      });
    }
    await ctx.db.insert("changeRequestItems", {
      organizationId: args.organizationId,
      changeRequestId: args.changeRequestId,
      itemId: item._id,
      itemNumberSnapshot: item.itemNumber,
      itemNameSnapshot: item.name,
      currentRevisionSnapshot: item.revision,
      createdAt: Date.now(),
    });
  }
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("triage"),
        v.literal("in_review"),
        v.literal("approved"),
        v.literal("implementing"),
        v.literal("verified"),
        v.literal("closed"),
        v.literal("rejected"),
      ),
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    ),
    ownerProfileId: v.optional(v.id("userProfiles")),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const page = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(args.paginationOpts);
    const search = args.search?.toLowerCase().trim();
    const now = Date.now();
    return {
      ...page,
      page: page.page
        .filter((cr) => {
          if (args.status && cr.status !== args.status) return false;
          if (args.priority && cr.priority !== args.priority) return false;
          if (args.ownerProfileId && cr.ownerProfileId !== args.ownerProfileId) return false;
          if (
            search &&
            !`${cr.crNumber} ${cr.title} ${cr.description} ${cr.reason}`.toLowerCase().includes(search)
          ) {
            return false;
          }
          return true;
        })
        .map((cr) => ({
          ...cr,
          isOverdue:
            Boolean(cr.statusSlaDueAt) &&
            now > (cr.statusSlaDueAt ?? 0) &&
            !isTerminalStatus(cr.status),
          timeInStateMs: now - cr.statusEnteredAt,
        })),
    };
  },
});

export const getDetail = query({
  args: { organizationId: v.id("organizations"), changeRequestId: v.id("changeRequests") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const changeRequest = await ensureCrInOrg(ctx, args.organizationId, args.changeRequestId);
    const [affectedItems, approvals, comments, attachments, auditLogs, eco] = await Promise.all([
      ctx.db
        .query("changeRequestItems")
        .withIndex("by_org_and_changeRequest", (q) =>
          q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
        )
        .collect(),
      ctx.db
        .query("approvals")
        .withIndex("by_org_and_changeRequest", (q) =>
          q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
        )
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_org_and_entity", (q) =>
          q.eq("organizationId", args.organizationId)
            .eq("entityType", "changeRequest")
            .eq("entityId", String(args.changeRequestId)),
        )
        .collect(),
      ctx.db
        .query("attachments")
        .withIndex("by_org_and_entity", (q) =>
          q.eq("organizationId", args.organizationId)
            .eq("entityType", "changeRequest")
            .eq("entityId", String(args.changeRequestId)),
        )
        .collect(),
      ctx.db
        .query("auditLogs")
        .withIndex("by_org_and_entity", (q) =>
          q.eq("organizationId", args.organizationId)
            .eq("entityType", "changeRequest")
            .eq("entityId", String(args.changeRequestId)),
        )
        .collect(),
      changeRequest.ecoId ? ctx.db.get(changeRequest.ecoId) : Promise.resolve(null),
    ]);

    return {
      changeRequest,
      affectedItems,
      approvals,
      comments: comments.sort((a, b) => a.createdAt - b.createdAt),
      attachments,
      auditLogs: auditLogs.sort((a, b) => b.timestamp - a.timestamp),
      eco,
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    reason: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    changeType: v.union(
      v.literal("design"),
      v.literal("process"),
      v.literal("software"),
      v.literal("document"),
      v.literal("other"),
    ),
    affectedItemIds: v.array(v.id("items")),
    ownerProfileId: v.optional(v.id("userProfiles")),
    watcherProfileIds: v.optional(v.array(v.id("userProfiles"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const parsed = createSchema.parse({
      ...args,
      ownerProfileId: args.ownerProfileId ? String(args.ownerProfileId) : undefined,
      watcherProfileIds: (args.watcherProfileIds ?? []).map(String),
      affectedItemIds: args.affectedItemIds.map(String),
    });
    const now = Date.now();
    const seq = await nextCounterValue(ctx, args.organizationId, "cr");
    const crNumber = formatSequence("CR", seq);
    const status: Doc<"changeRequests">["status"] = "draft";
    const watcherProfileIds = [...new Set(args.watcherProfileIds ?? [])].filter(
      (id) => id !== actor.profile._id,
    );

    const changeRequestId = await ctx.db.insert("changeRequests", {
      organizationId: args.organizationId,
      crNumber,
      title: parsed.title,
      description: parsed.description,
      reason: parsed.reason,
      priority: parsed.priority,
      changeType: parsed.changeType,
      status,
      ownerProfileId: args.ownerProfileId,
      createdByProfileId: actor.profile._id,
      watcherProfileIds,
      dueDate: args.dueDate,
      statusEnteredAt: now,
      statusSlaDueAt: computeStatusSlaDueAt(status, now, args.dueDate),
      createdAt: now,
      updatedAt: now,
    });

    await replaceAffectedItems(ctx, {
      organizationId: args.organizationId,
      changeRequestId,
      affectedItemIds: args.affectedItemIds,
    });

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "changeRequest",
      entityId: String(changeRequestId),
      action: "cr_created",
      actorProfileId: actor.profile._id,
      toStatus: status,
      metadata: { crNumber },
    });

    const notifyIds = [args.ownerProfileId, ...watcherProfileIds].filter(
      (id): id is Id<"userProfiles"> => Boolean(id),
    );
    if (notifyIds.length > 0) {
      await createNotifications(ctx, {
        organizationId: args.organizationId,
        recipientProfileIds: notifyIds,
        type: "cr_created",
        title: `New change request ${crNumber}`,
        body: parsed.title,
        relatedEntityType: "changeRequest",
        relatedEntityId: String(changeRequestId),
      });
    }

    return changeRequestId;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    reason: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    ),
    changeType: v.optional(
      v.union(
        v.literal("design"),
        v.literal("process"),
        v.literal("software"),
        v.literal("document"),
        v.literal("other"),
      ),
    ),
    affectedItemIds: v.optional(v.array(v.id("items"))),
    ownerProfileId: v.optional(v.id("userProfiles")),
    watcherProfileIds: v.optional(v.array(v.id("userProfiles"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const current = await ensureCrInOrg(ctx, args.organizationId, args.changeRequestId);
    if (current.status !== "draft" && current.status !== "submitted" && current.status !== "triage") {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Only Draft/Submitted/Triage change requests can be edited.",
      });
    }
    const parsed = updateSchema.parse({
      ...args,
      ownerProfileId: args.ownerProfileId ? String(args.ownerProfileId) : undefined,
      watcherProfileIds: args.watcherProfileIds?.map(String),
      affectedItemIds: args.affectedItemIds?.map(String),
    });

    await ctx.db.patch("changeRequests", current._id, {
      title: parsed.title ?? current.title,
      description: parsed.description ?? current.description,
      reason: parsed.reason ?? current.reason,
      priority: parsed.priority ?? current.priority,
      changeType: parsed.changeType ?? current.changeType,
      ownerProfileId: args.ownerProfileId ?? current.ownerProfileId,
      watcherProfileIds: args.watcherProfileIds
        ? [...new Set(args.watcherProfileIds)].filter((id) => id !== actor.profile._id)
        : current.watcherProfileIds,
      dueDate: args.dueDate ?? current.dueDate,
      statusSlaDueAt: computeStatusSlaDueAt(current.status, current.statusEnteredAt, args.dueDate ?? current.dueDate),
      updatedAt: Date.now(),
    });

    if (args.affectedItemIds) {
      await replaceAffectedItems(ctx, {
        organizationId: args.organizationId,
        changeRequestId: current._id,
        affectedItemIds: args.affectedItemIds,
      });
    }

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "changeRequest",
      entityId: String(current._id),
      action: "cr_updated",
      actorProfileId: actor.profile._id,
    });

    return current._id;
  },
});

export const transitionStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    toStatus: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("triage"),
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("implementing"),
      v.literal("verified"),
      v.literal("closed"),
      v.literal("rejected"),
    ),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { actor, membership } = await requireOrgRole(ctx, args.organizationId, [
      "admin",
      "engineer",
      "approver",
    ]);
    const current = await ensureCrInOrg(ctx, args.organizationId, args.changeRequestId);
    if (current.status === args.toStatus) {
      return { changeRequestId: current._id, status: current.status };
    }
    if (!canTransitionStatus(current.status, args.toStatus, membership.role)) {
      throw new ConvexError({
        code: "INVALID_TRANSITION",
        message: `Role ${membership.role} cannot move ${current.status} -> ${args.toStatus}`,
      });
    }

    if (args.toStatus === "approved") {
      const policy = await ctx.db
        .query("approvalPolicies")
        .withIndex("by_org_and_active", (q) =>
          q.eq("organizationId", args.organizationId).eq("active", true),
        )
        .unique();
      const decisions = await ctx.db
        .query("approvals")
        .withIndex("by_org_and_changeRequest", (q) =>
          q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
        )
        .collect();
      const approvedCount = decisions.filter(
        (approval) => approval.category === "approver" && approval.decision === "approved",
      ).length;
      const hasRejection = decisions.some((approval) => approval.decision === "rejected");
      const minApprovals = policy?.minApproverCount ?? 1;
      if (hasRejection || approvedCount < minApprovals) {
        throw new ConvexError({
          code: "APPROVAL_REQUIRED",
          message: `Approval policy not satisfied (${approvedCount}/${minApprovals} approver approvals).`,
        });
      }
    }

    if (args.toStatus === "in_review") {
      const existing = await ctx.db
        .query("approvals")
        .withIndex("by_org_and_changeRequest", (q) =>
          q.eq("organizationId", args.organizationId).eq("changeRequestId", args.changeRequestId),
        )
        .collect();
      if (existing.length === 0) {
        const approvers = await ctx.db
          .query("memberships")
          .withIndex("by_org_and_role", (q) =>
            q.eq("organizationId", args.organizationId).eq("role", "approver"),
          )
          .collect();
        const now = Date.now();
        for (const approver of approvers.filter((m) => m.isActive)) {
          await ctx.db.insert("approvals", {
            organizationId: args.organizationId,
            changeRequestId: args.changeRequestId,
            profileId: approver.profileId,
            category: "approver",
            decision: "pending",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    if (args.toStatus === "approved") {
      await ensureEcoForChangeRequest(ctx, current, actor.profile._id);
    }

    const now = Date.now();
    await ctx.db.patch("changeRequests", current._id, updateStatusTimestamps(current, args.toStatus, now));
    const refreshed = await ctx.db.get(current._id);
    if (!refreshed) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Change request disappeared" });
    }

    let closureMetadata: unknown = undefined;
    if (args.toStatus === "closed") {
      closureMetadata = await applyEcoClosureToItems(ctx, refreshed, actor.profile._id);
    }

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "changeRequest",
      entityId: String(current._id),
      action: "cr_status_transition",
      actorProfileId: actor.profile._id,
      fromStatus: current.status,
      toStatus: args.toStatus,
      comment: args.comment,
      metadata: closureMetadata,
    });

    const notifyIds = [
      refreshed.ownerProfileId,
      refreshed.createdByProfileId,
      ...refreshed.watcherProfileIds,
    ].filter((id): id is Id<"userProfiles"> => Boolean(id));
    if (notifyIds.length > 0) {
      await createNotifications(ctx, {
        organizationId: args.organizationId,
        recipientProfileIds: notifyIds,
        type: "cr_status_changed",
        title: `${refreshed.crNumber} moved to ${args.toStatus.replaceAll("_", " ")}`,
        body: args.comment?.trim() || refreshed.title,
        relatedEntityType: "changeRequest",
        relatedEntityId: String(refreshed._id),
      });
    }

    return { changeRequestId: refreshed._id, status: refreshed.status, ecoId: refreshed.ecoId };
  },
});
