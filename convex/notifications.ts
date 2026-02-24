import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActor, requireOrgRole } from "./lib/authz";

export const listMine = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    unreadOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_createdAt", (q) => q.eq("recipientProfileId", actor.profile._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.filter((n) => {
        if (args.organizationId && n.organizationId !== args.organizationId) return false;
        if (args.unreadOnly && n.isRead) return false;
        return true;
      }),
    };
  },
});

export const unreadCount = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientProfileId", actor.profile._id).eq("isRead", false),
      )
      .collect();
    return rows.filter((row) => !args.organizationId || row.organizationId === args.organizationId)
      .length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
    }
    if (notification.recipientProfileId !== actor.profile._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Cannot update another user's notification" });
    }
    if (!notification.isRead) {
      await ctx.db.patch("notifications", notification._id, { isRead: true, readAt: Date.now() });
    }
    return true;
  },
});

export const markAllReadForOrg = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const actor = await requireActor(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_isRead", (q) =>
        q.eq("recipientProfileId", actor.profile._id).eq("isRead", false),
      )
      .collect();
    const now = Date.now();
    let updated = 0;
    for (const row of unread) {
      if (row.organizationId !== args.organizationId) continue;
      await ctx.db.patch("notifications", row._id, { isRead: true, readAt: now });
      updated += 1;
    }
    return updated;
  },
});
