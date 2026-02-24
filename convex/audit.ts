import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireOrgRole } from "./lib/authz";

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "approver", "viewer", "engineer"]);
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_org_and_timestamp", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.filter((log) => {
        if (args.entityType && log.entityType !== args.entityType) return false;
        if (args.action && log.action !== args.action) return false;
        if (args.startDate && log.timestamp < args.startDate) return false;
        if (args.endDate && log.timestamp > args.endDate) return false;
        return true;
      }),
    };
  },
});

export const exportRows = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "approver", "viewer", "engineer"]);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org_and_timestamp", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
    return rows.filter((log) => {
      if (args.entityType && log.entityType !== args.entityType) return false;
      if (args.action && log.action !== args.action) return false;
      if (args.startDate && log.timestamp < args.startDate) return false;
      if (args.endDate && log.timestamp > args.endDate) return false;
      return true;
    });
  },
});

export const exportCsv = action({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.audit.exportRows, args);
    const headers = [
      "timestamp",
      "entityType",
      "entityId",
      "action",
      "actorProfileId",
      "fromStatus",
      "toStatus",
      "comment",
      "metadataJson",
    ];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(
        [
          new Date(row.timestamp).toISOString(),
          row.entityType,
          row.entityId,
          row.action,
          row.actorProfileId ?? "",
          row.fromStatus ?? "",
          row.toStatus ?? "",
          row.comment ?? "",
          row.metadataJson ?? "",
        ]
          .map(escape)
          .join(","),
      );
    }
    return { fileName: `audit-${args.organizationId}.csv`, csv: lines.join("\n") };
  },
});
