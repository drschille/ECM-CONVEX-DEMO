import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { computeStatusSlaDueAt, incrementRevision } from "./domain";

export async function nextCounterValue(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  key: string,
): Promise<number> {
  const now = Date.now();
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_org_and_key", (q) => q.eq("organizationId", organizationId).eq("key", key))
    .unique();

  if (!counter) {
    await ctx.db.insert("counters", {
      organizationId,
      key,
      lastValue: 1,
      updatedAt: now,
    });
    return 1;
  }

  const next = counter.lastValue + 1;
  await ctx.db.patch("counters", counter._id, {
    lastValue: next,
    updatedAt: now,
  });
  return next;
}

export async function appendAuditLog(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    entityType: string;
    entityId: string;
    action: string;
    actorProfileId?: Id<"userProfiles">;
    fromStatus?: string;
    toStatus?: string;
    comment?: string;
    metadata?: unknown;
  },
): Promise<Id<"auditLogs">> {
  return await ctx.db.insert("auditLogs", {
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorProfileId: input.actorProfileId,
    timestamp: Date.now(),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    comment: input.comment,
    metadataJson: input.metadata === undefined ? undefined : JSON.stringify(input.metadata),
  });
}

export async function createNotifications(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    recipientProfileIds: Id<"userProfiles">[];
    type: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  },
): Promise<void> {
  const now = Date.now();
  const uniqueRecipients = [...new Set(input.recipientProfileIds)];
  for (const recipientProfileId of uniqueRecipients) {
    await ctx.db.insert("notifications", {
      organizationId: input.organizationId,
      recipientProfileId,
      type: input.type,
      title: input.title,
      body: input.body,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      isRead: false,
      createdAt: now,
    });
  }
}

export function formatSequence(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(6, "0")}`;
}

export function updateStatusTimestamps(
  current: Doc<"changeRequests">,
  nextStatus: Doc<"changeRequests">["status"],
  now: number,
): Partial<Doc<"changeRequests">> {
  const patch: Partial<Doc<"changeRequests">> = {
    status: nextStatus,
    statusEnteredAt: now,
    statusSlaDueAt: computeStatusSlaDueAt(nextStatus, now, current.dueDate),
    updatedAt: now,
  };
  if (nextStatus === "submitted") patch.submittedAt = now;
  if (nextStatus === "triage") patch.triageAt = now;
  if (nextStatus === "in_review") patch.reviewStartedAt = now;
  if (nextStatus === "approved") patch.approvedAt = now;
  if (nextStatus === "implementing") patch.implementingAt = now;
  if (nextStatus === "verified") patch.verifiedAt = now;
  if (nextStatus === "closed") patch.closedAt = now;
  if (nextStatus === "rejected") patch.rejectedAt = now;
  return patch;
}

export async function ensureEcoForChangeRequest(
  ctx: MutationCtx,
  changeRequest: Doc<"changeRequests">,
  actorProfileId: Id<"userProfiles">,
): Promise<Id<"ecos">> {
  if (changeRequest.ecoId) {
    return changeRequest.ecoId;
  }
  const next = await nextCounterValue(ctx, changeRequest.organizationId, "eco");
  const ecoId = await ctx.db.insert("ecos", {
    organizationId: changeRequest.organizationId,
    changeRequestId: changeRequest._id,
    ecoNumber: formatSequence("ECO", next),
    implementationChecklist: [
      { id: "plan", label: "Implementation plan complete", completed: false },
      { id: "execute", label: "Change implemented", completed: false },
      { id: "verify", label: "Verification evidence attached", completed: false },
    ],
    requiredSignoffCategories: [],
    signoffs: [],
    resultingItemUpdates: [],
    status: "open",
    createdByProfileId: actorProfileId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await ctx.db.patch("changeRequests", changeRequest._id, { ecoId, updatedAt: Date.now() });
  return ecoId;
}

export async function applyEcoClosureToItems(
  ctx: MutationCtx,
  changeRequest: Doc<"changeRequests">,
  actorProfileId: Id<"userProfiles">,
): Promise<{ releaseNote: string; updatedItems: number }> {
  const links = await ctx.db
    .query("changeRequestItems")
    .withIndex("by_org_and_changeRequest", (q) =>
      q.eq("organizationId", changeRequest.organizationId).eq("changeRequestId", changeRequest._id),
    )
    .collect();

  const results: Array<{ itemId: Id<"items">; fromRevision: string; toRevision: string; itemNumber: string }> =
    [];

  for (const link of links) {
    const item = await ctx.db.get("items", link.itemId);
    if (!item) continue;
    const nextRevision = incrementRevision(item.revision);
    await ctx.db.patch("items", item._id, {
      revision: nextRevision,
      updatedAt: Date.now(),
    });
    results.push({
      itemId: item._id,
      fromRevision: item.revision,
      toRevision: nextRevision,
      itemNumber: item.itemNumber,
    });
    await appendAuditLog(ctx, {
      organizationId: changeRequest.organizationId,
      entityType: "item",
      entityId: String(item._id),
      action: "revision_incremented_from_eco",
      actorProfileId,
      metadata: { changeRequestId: changeRequest._id, fromRevision: item.revision, toRevision: nextRevision },
    });
  }

  const eco = changeRequest.ecoId ? await ctx.db.get("ecos", changeRequest.ecoId) : null;
  if (!eco) {
    throw new ConvexError({ code: "ECO_REQUIRED", message: "Approved CR must have an ECO." });
  }

  const releaseNote = `Release generated from ${changeRequest.crNumber}: ${results
    .map((r) => `${r.itemNumber} ${r.fromRevision}->${r.toRevision}`)
    .join(", ")}`;

  await ctx.db.patch("ecos", eco._id, {
    resultingItemUpdates: results.map((r) => ({
      itemId: r.itemId,
      fromRevision: r.fromRevision,
      toRevision: r.toRevision,
    })),
    releaseNote,
    status: "closed",
    updatedAt: Date.now(),
  });

  return { releaseNote, updatedItems: results.length };
}
