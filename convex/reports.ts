import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireActor, requireOrgRole } from "./lib/authz";
import { isTerminalStatus } from "./lib/domain";

export const dashboard = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const rows = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(200);
    const now = Date.now();
    const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    const overdue = rows.filter(
      (row) => row.statusSlaDueAt && row.statusSlaDueAt < now && !isTerminalStatus(row.status),
    );
    const myAssigned = rows.filter((row) => row.ownerProfileId === actor.profile._id);
    return {
      totals: {
        open: rows.filter((row) => !isTerminalStatus(row.status)).length,
        overdue: overdue.length,
        mine: myAssigned.length,
      },
      byStatus,
      overdue: overdue.slice(0, 10),
      myAssigned: myAssigned.slice(0, 10),
      recentlyUpdated: rows.slice(0, 10),
    };
  },
});

export const changeRequestReport = query({
  args: {
    organizationId: v.id("organizations"),
    ownerProfileId: v.optional(v.id("userProfiles")),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const page = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.filter((row) => {
        if (args.ownerProfileId && row.ownerProfileId !== args.ownerProfileId) return false;
        if (args.status && row.status !== args.status) return false;
        if (args.priority && row.priority !== args.priority) return false;
        if (args.startDate && row.createdAt < args.startDate) return false;
        if (args.endDate && row.createdAt > args.endDate) return false;
        return true;
      }),
    };
  },
});

export const exportChangeRequestsRows = query({
  args: {
    organizationId: v.id("organizations"),
    ownerProfileId: v.optional(v.id("userProfiles")),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const rows = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
    return rows.filter((row) => {
      if (args.ownerProfileId && row.ownerProfileId !== args.ownerProfileId) return false;
      if (args.status && row.status !== args.status) return false;
      if (args.priority && row.priority !== args.priority) return false;
      if (args.startDate && row.createdAt < args.startDate) return false;
      if (args.endDate && row.createdAt > args.endDate) return false;
      return true;
    });
  },
});

export const exportChangeRequestsCsv = action({
  args: {
    organizationId: v.id("organizations"),
    ownerProfileId: v.optional(v.id("userProfiles")),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.reports.exportChangeRequestsRows, args);
    const headers = [
      "crNumber",
      "title",
      "status",
      "priority",
      "changeType",
      "ownerProfileId",
      "dueDate",
      "createdAt",
      "updatedAt",
    ];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.crNumber,
          row.title,
          row.status,
          row.priority,
          row.changeType,
          row.ownerProfileId ?? "",
          row.dueDate ? new Date(row.dueDate).toISOString() : "",
          new Date(row.createdAt).toISOString(),
          new Date(row.updatedAt).toISOString(),
        ]
          .map(escape)
          .join(","),
      );
    }
    return { fileName: `change-requests-${args.organizationId}.csv`, csv: lines.join("\n") };
  },
});

export const myWorkSummary = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const mine = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_owner", (q) =>
        q.eq("organizationId", args.organizationId).eq("ownerProfileId", actor.profile._id),
      )
      .collect();
    return {
      total: mine.length,
      open: mine.filter((row) => !isTerminalStatus(row.status)).length,
      overdue: mine.filter(
        (row) => row.statusSlaDueAt && row.statusSlaDueAt < Date.now() && !isTerminalStatus(row.status),
      ).length,
    };
  },
});
