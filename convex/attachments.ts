import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgRole } from "./lib/authz";
import { appendAuditLog } from "./lib/platform";

async function validateTarget(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  organizationId: any,
  entityType: "changeRequest" | "eco",
  entityId: string,
) {
  if (entityType === "changeRequest") {
    const cr = await ctx.db.get("changeRequests", entityId);
    if (!cr || cr.organizationId !== organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Change request not found" });
    }
    return;
  }
  const eco = await ctx.db.get("ecos", entityId);
  if (!eco || eco.organizationId !== organizationId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "ECO not found" });
  }
}

export const generateUploadUrl = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const add = mutation({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver"]);
    await validateTarget(ctx, args.organizationId, args.entityType, args.entityId);
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Uploaded file not found in storage" });
    }
    const attachmentId = await ctx.db.insert("attachments", {
      organizationId: args.organizationId,
      entityType: args.entityType,
      entityId: args.entityId,
      fileName: args.fileName.trim(),
      contentType: args.contentType.trim(),
      sizeBytes: args.sizeBytes,
      storageId: args.storageId,
      uploadedByProfileId: actor.profile._id,
      createdAt: Date.now(),
    });
    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "attachment",
      entityId: String(attachmentId),
      action: "attachment_added",
      actorProfileId: actor.profile._id,
      metadata: { entityType: args.entityType, entityId: args.entityId, fileName: args.fileName },
    });
    return attachmentId;
  },
});

export const listForEntity = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const rows = await ctx.db
      .query("attachments")
      .withIndex("by_org_and_entity", (q) =>
        q.eq("organizationId", args.organizationId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId),
      )
      .collect();
    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        downloadUrl: await ctx.storage.getUrl(row.storageId),
      })),
    );
    return withUrls.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const remove = mutation({
  args: { organizationId: v.id("organizations"), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin", "engineer"]);
    const attachment = await ctx.db.get("attachments", args.attachmentId);
    if (!attachment || attachment.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Attachment not found" });
    }
    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete("attachments", attachment._id);
    await appendAuditLog(ctx, {
      organizationId: args.organizationId,
      entityType: "attachment",
      entityId: String(attachment._id),
      action: "attachment_removed",
      actorProfileId: actor.profile._id,
      metadata: { fileName: attachment.fileName },
    });
    return true;
  },
});
