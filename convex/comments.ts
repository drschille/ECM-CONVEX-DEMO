import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgRole } from "./lib/authz";
import { parseMentions } from "./lib/domain";
import { appendAuditLog, createNotifications } from "./lib/platform";

async function resolveMentionProfileIds(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  organizationId: Id<"organizations">,
  mentionTokens: string[],
): Promise<Id<"userProfiles">[]> {
  if (mentionTokens.length === 0) return [];
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q: any) => q.eq("organizationId", organizationId))
    .collect();
  const results: Id<"userProfiles">[] = [];
  for (const membership of memberships) {
    if (!membership.isActive) continue;
    const profile = await ctx.db.get("userProfiles", membership.profileId);
    if (!profile) continue;
    const name = profile.name.toLowerCase();
    const emailUser = profile.email.split("@")[0]?.toLowerCase() ?? "";
    if (mentionTokens.some((token) => token === emailUser || token === name)) {
      results.push(profile._id);
    }
  }
  return [...new Set(results)];
}

async function validateEntity(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  args: { organizationId: Id<"organizations">; entityType: "changeRequest" | "eco"; entityId: string },
) {
  if (args.entityType === "changeRequest") {
    const entity = await ctx.db.get("changeRequests", args.entityId as Id<"changeRequests">);
    if (!entity || entity.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Change request not found" });
    }
    return entity;
  }
  const entity = await ctx.db.get("ecos", args.entityId as Id<"ecos">);
  if (!entity || entity.organizationId !== args.organizationId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "ECO not found" });
  }
  return entity;
}

export const listForEntity = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_org_and_entity", (q) =>
        q.eq("organizationId", args.organizationId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId),
      )
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const add = mutation({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
    body: v.string(),
    parentCommentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver"]);
    const body = args.body.trim();
    if (!body) {
      throw new ConvexError({ code: "VALIDATION", message: "Comment body is required" });
    }
    await validateEntity(ctx, args);
    if (args.parentCommentId) {
      const parent = await ctx.db.get("comments", args.parentCommentId);
      if (
        !parent ||
        parent.organizationId !== args.organizationId ||
        parent.entityType !== args.entityType ||
        parent.entityId !== args.entityId
      ) {
        throw new ConvexError({ code: "VALIDATION", message: "Invalid parent comment" });
      }
    }

    const mentionTokens = parseMentions(body);
    const mentionProfileIds = await resolveMentionProfileIds(ctx, args.organizationId, mentionTokens);
    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      organizationId: args.organizationId,
      entityType: args.entityType,
      entityId: args.entityId,
      parentCommentId: args.parentCommentId,
      body,
      authorProfileId: actor.profile._id,
      mentionProfileIds,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "comment",
      entityId: String(commentId),
      action: "comment_created",
      actorProfileId: actor.profile._id,
      metadata: { parentCommentId: args.parentCommentId, mentions: mentionTokens },
    });

    if (mentionProfileIds.length > 0) {
      await createNotifications(ctx, {
        organizationId: args.organizationId,
        recipientProfileIds: mentionProfileIds.filter((id) => id !== actor.profile._id),
        type: "mention",
        title: `You were mentioned in a ${args.entityType} comment`,
        body: body.slice(0, 160),
        relatedEntityType: args.entityType,
        relatedEntityId: args.entityId,
      });
    }

    return commentId;
  },
});
