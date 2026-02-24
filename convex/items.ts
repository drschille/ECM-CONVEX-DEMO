import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireOrgRole } from "./lib/authz";
import { appendAuditLog } from "./lib/platform";
import { toSearchText } from "./lib/domain";

const itemCreateSchema = z.object({
  itemNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).default(""),
  revision: z.string().trim().min(1).max(32),
  lifecycleState: z.enum(["draft", "released", "obsolete"]),
  tags: z.array(z.string().trim().min(1).max(50)).max(25).default([]),
});

function normalizeItemInput(args: {
  itemNumber: string;
  name: string;
  description?: string;
  revision: string;
  lifecycleState: Doc<"items">["lifecycleState"];
  tags?: string[];
}) {
  return itemCreateSchema.parse({
    itemNumber: args.itemNumber,
    name: args.name,
    description: args.description ?? "",
    revision: args.revision,
    lifecycleState: args.lifecycleState,
    tags: (args.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  });
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
    lifecycleState: v.optional(
      v.union(v.literal("draft"), v.literal("released"), v.literal("obsolete")),
    ),
    tag: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);

    const page = await ctx.db
      .query("items")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(args.paginationOpts);

    const search = args.search?.toLowerCase().trim();
    const tag = args.tag?.toLowerCase().trim();

    const filtered = page.page.filter((item) => {
      if (args.lifecycleState && item.lifecycleState !== args.lifecycleState) return false;
      if (tag && !item.tags.map((t) => t.toLowerCase()).includes(tag)) return false;
      if (search && !item.searchText.includes(search)) return false;
      return true;
    });

    return {
      ...page,
      page: filtered,
    };
  },
});

export const get = query({
  args: { organizationId: v.id("organizations"), itemId: v.id("items") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Item not found" });
    }
    return item;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemNumber: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    revision: v.string(),
    lifecycleState: v.union(v.literal("draft"), v.literal("released"), v.literal("obsolete")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const parsed = normalizeItemInput(args);
    const existing = await ctx.db
      .query("items")
      .withIndex("by_org_and_itemNumber", (q) =>
        q.eq("organizationId", args.organizationId).eq("itemNumber", parsed.itemNumber),
      )
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "itemNumber must be unique per org" });
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("items", {
      organizationId: args.organizationId,
      itemNumber: parsed.itemNumber,
      name: parsed.name,
      description: parsed.description,
      revision: parsed.revision,
      lifecycleState: parsed.lifecycleState,
      tags: parsed.tags,
      searchText: toSearchText([parsed.itemNumber, parsed.name, parsed.description, ...parsed.tags]),
      createdByProfileId: actor.profile._id,
      createdAt: now,
      updatedAt: now,
    });

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "item",
      entityId: String(itemId),
      action: "item_created",
      actorProfileId: actor.profile._id,
      metadata: { itemNumber: parsed.itemNumber },
    });

    return itemId;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    revision: v.optional(v.string()),
    lifecycleState: v.optional(
      v.union(v.literal("draft"), v.literal("released"), v.literal("obsolete")),
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Item not found" });
    }

    const next = normalizeItemInput({
      itemNumber: item.itemNumber,
      name: args.name ?? item.name,
      description: args.description ?? item.description,
      revision: args.revision ?? item.revision,
      lifecycleState: args.lifecycleState ?? item.lifecycleState,
      tags: args.tags ?? item.tags,
    });

    await ctx.db.patch("items", item._id, {
      name: next.name,
      description: next.description,
      revision: next.revision,
      lifecycleState: next.lifecycleState,
      tags: next.tags,
      searchText: toSearchText([item.itemNumber, next.name, next.description, ...next.tags]),
      updatedAt: Date.now(),
    });

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "item",
      entityId: String(item._id),
      action: "item_updated",
      actorProfileId: actor.profile._id,
      metadata: {
        before: {
          name: item.name,
          description: item.description,
          revision: item.revision,
          lifecycleState: item.lifecycleState,
          tags: item.tags,
        },
        after: {
          name: next.name,
          description: next.description,
          revision: next.revision,
          lifecycleState: next.lifecycleState,
          tags: next.tags,
        },
      },
    });

    return item._id;
  },
});

export const listForPicker = query({
  args: { organizationId: v.id("organizations"), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const rows = await ctx.db
      .query("items")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(100);
    const search = args.search?.toLowerCase().trim();
    return rows
      .filter((item) => !search || item.searchText.includes(search))
      .map((item) => ({
        _id: item._id,
        itemNumber: item.itemNumber,
        name: item.name,
        revision: item.revision,
        lifecycleState: item.lifecycleState,
      }));
  },
});

export const commitCsvImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    fileName: v.string(),
    rows: v.array(
      v.object({
        rowNumber: v.number(),
        itemNumber: v.string(),
        name: v.string(),
        description: v.string(),
        revision: v.string(),
        lifecycleState: v.union(v.literal("draft"), v.literal("released"), v.literal("obsolete")),
        tags: v.array(v.string()),
      }),
    ),
    errors: v.array(
      v.object({
        rowNumber: v.number(),
        itemNumber: v.optional(v.string()),
        message: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    let insertedCount = 0;
    let updatedCount = 0;
    const now = Date.now();

    for (const row of args.rows) {
      const existing = await ctx.db
        .query("items")
        .withIndex("by_org_and_itemNumber", (q) =>
          q.eq("organizationId", args.organizationId).eq("itemNumber", row.itemNumber),
        )
        .unique();

      const payload = {
        name: row.name,
        description: row.description,
        revision: row.revision,
        lifecycleState: row.lifecycleState,
        tags: row.tags,
        searchText: toSearchText([row.itemNumber, row.name, row.description, ...row.tags]),
        updatedAt: now,
      } as const;

      if (existing) {
        await ctx.db.patch("items", existing._id, payload);
        updatedCount += 1;
      } else {
        await ctx.db.insert("items", {
          organizationId: args.organizationId,
          itemNumber: row.itemNumber,
          createdByProfileId: actor.profile._id,
          createdAt: now,
          ...payload,
        });
        insertedCount += 1;
      }
    }

    const importId = await ctx.db.insert("itemImports", {
      organizationId: args.organizationId,
      fileName: args.fileName,
      uploadedByProfileId: actor.profile._id,
      totalRows: args.rows.length + args.errors.length,
      insertedCount,
      updatedCount,
      errorCount: args.errors.length,
      errors: args.errors,
      createdAt: now,
    });

    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "itemImport",
      entityId: String(importId),
      action: "items_csv_imported",
      actorProfileId: actor.profile._id,
      metadata: { insertedCount, updatedCount, errorCount: args.errors.length, fileName: args.fileName },
    });

    return { importId, insertedCount, updatedCount, errorCount: args.errors.length };
  },
});

export const listImports = query({
  args: { organizationId: v.id("organizations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    return await ctx.db
      .query("itemImports")
      .withIndex("by_org_and_createdAt", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
