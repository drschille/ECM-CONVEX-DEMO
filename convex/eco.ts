import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgRole } from "./lib/authz";
import { appendAuditLog, createNotifications } from "./lib/platform";

export const get = query({
  args: { organizationId: v.id("organizations"), ecoId: v.id("ecos") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const eco = await ctx.db.get("ecos", args.ecoId);
    if (!eco || eco.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "ECO not found" });
    }
    return eco;
  },
});

export const updateChecklist = mutation({
  args: {
    organizationId: v.id("organizations"),
    ecoId: v.id("ecos"),
    checklist: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        completed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const eco = await ctx.db.get("ecos", args.ecoId);
    if (!eco || eco.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "ECO not found" });
    }
    const now = Date.now();
    const existingById = new Map(eco.implementationChecklist.map((entry) => [entry.id, entry]));
    const next = args.checklist.map((entry) => {
      const previous = existingById.get(entry.id);
      const completedChanged = previous?.completed !== entry.completed;
      return {
        id: entry.id,
        label: entry.label,
        completed: entry.completed,
        completedAt:
          entry.completed && (completedChanged ? now : previous?.completedAt)
            ? (completedChanged ? now : previous?.completedAt)
            : undefined,
        completedByProfileId:
          entry.completed && (completedChanged ? actor.profile._id : previous?.completedByProfileId)
            ? (completedChanged ? actor.profile._id : previous?.completedByProfileId)
            : undefined,
      };
    });
    await ctx.db.patch("ecos", eco._id, { implementationChecklist: next, updatedAt: now });
    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "eco",
      entityId: String(eco._id),
      action: "eco_checklist_updated",
      actorProfileId: actor.profile._id,
    });
    return eco._id;
  },
});

export const recordSignoff = mutation({
  args: {
    organizationId: v.id("organizations"),
    ecoId: v.id("ecos"),
    category: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "approver"]);
    const eco = await ctx.db.get("ecos", args.ecoId);
    if (!eco || eco.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "ECO not found" });
    }
    const now = Date.now();
    const category = args.category.trim();
    const nextSignoffs = [...eco.signoffs];
    const index = nextSignoffs.findIndex(
      (signoff) => signoff.category.toLowerCase() === category.toLowerCase(),
    );
    const value = {
      category,
      profileId: actor.profile._id,
      status: args.decision,
      comment: args.comment?.trim(),
      decidedAt: now,
    } as const;
    if (index >= 0) {
      nextSignoffs[index] = value;
    } else {
      nextSignoffs.push(value);
    }
    await ctx.db.patch("ecos", eco._id, { signoffs: nextSignoffs, updatedAt: now });
    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "eco",
      entityId: String(eco._id),
      action: "eco_signoff_recorded",
      actorProfileId: actor.profile._id,
      comment: args.comment,
      metadata: { category, decision: args.decision },
    });

    const cr = await ctx.db.get("changeRequests", eco.changeRequestId);
    if (cr) {
      await createNotifications(ctx, {
        organizationId: args.organizationId,
        recipientProfileIds: [cr.createdByProfileId, ...(cr.ownerProfileId ? [cr.ownerProfileId] : []), ...cr.watcherProfileIds],
        type: "eco_signoff",
        title: `${eco.ecoNumber} ${category} signoff ${args.decision}`,
        body: args.comment?.trim() || actor.profile.name,
        relatedEntityType: "eco",
        relatedEntityId: String(eco._id),
      });
    }
    return eco._id;
  },
});
