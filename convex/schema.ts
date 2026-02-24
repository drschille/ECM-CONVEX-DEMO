import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("engineer"),
  v.literal("approver"),
  v.literal("viewer"),
);

const lifecycleStateValidator = v.union(
  v.literal("draft"),
  v.literal("released"),
  v.literal("obsolete"),
);

const crStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("triage"),
  v.literal("in_review"),
  v.literal("approved"),
  v.literal("implementing"),
  v.literal("verified"),
  v.literal("closed"),
  v.literal("rejected"),
);

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

const changeTypeValidator = v.union(
  v.literal("design"),
  v.literal("process"),
  v.literal("software"),
  v.literal("document"),
  v.literal("other"),
);

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    authUserId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_auth_user_id", ["authUserId"])
    .index("by_updated_at", ["updatedAt"]),

  organizations: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    createdByProfileId: v.optional(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_updated_at", ["updatedAt"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    profileId: v.id("userProfiles"),
    role: roleValidator,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_profile", ["profileId"])
    .index("by_org_and_profile", ["organizationId", "profileId"])
    .index("by_org_and_role", ["organizationId", "role"]),

  approvalPolicies: defineTable({
    organizationId: v.id("organizations"),
    minApproverCount: v.number(),
    extraSignoffCategories: v.array(v.string()),
    active: v.boolean(),
    createdByProfileId: v.id("userProfiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_and_active", ["organizationId", "active"]),

  items: defineTable({
    organizationId: v.id("organizations"),
    itemNumber: v.string(),
    name: v.string(),
    description: v.string(),
    revision: v.string(),
    lifecycleState: lifecycleStateValidator,
    tags: v.array(v.string()),
    searchText: v.string(),
    createdByProfileId: v.id("userProfiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_and_itemNumber", ["organizationId", "itemNumber"])
    .index("by_org_and_updatedAt", ["organizationId", "updatedAt"])
    .index("by_org_and_lifecycleState", ["organizationId", "lifecycleState"]),

  counters: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    lastValue: v.number(),
    updatedAt: v.number(),
  }).index("by_org_and_key", ["organizationId", "key"]),

  changeRequests: defineTable({
    organizationId: v.id("organizations"),
    crNumber: v.string(),
    title: v.string(),
    description: v.string(),
    reason: v.string(),
    priority: priorityValidator,
    changeType: changeTypeValidator,
    status: crStatusValidator,
    ownerProfileId: v.optional(v.id("userProfiles")),
    createdByProfileId: v.id("userProfiles"),
    watcherProfileIds: v.array(v.id("userProfiles")),
    dueDate: v.optional(v.number()),
    statusEnteredAt: v.number(),
    statusSlaDueAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    triageAt: v.optional(v.number()),
    reviewStartedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    implementingAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    ecoId: v.optional(v.id("ecos")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_and_crNumber", ["organizationId", "crNumber"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_org_and_updatedAt", ["organizationId", "updatedAt"])
    .index("by_org_and_owner", ["organizationId", "ownerProfileId"])
    .index("by_org_and_priority", ["organizationId", "priority"]),

  changeRequestItems: defineTable({
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    itemId: v.id("items"),
    itemNumberSnapshot: v.string(),
    itemNameSnapshot: v.string(),
    currentRevisionSnapshot: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_and_changeRequest", ["organizationId", "changeRequestId"])
    .index("by_changeRequest_and_item", ["changeRequestId", "itemId"]),

  ecos: defineTable({
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    ecoNumber: v.string(),
    implementationChecklist: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        completed: v.boolean(),
        completedAt: v.optional(v.number()),
        completedByProfileId: v.optional(v.id("userProfiles")),
      }),
    ),
    requiredSignoffCategories: v.array(v.string()),
    signoffs: v.array(
      v.object({
        category: v.string(),
        profileId: v.optional(v.id("userProfiles")),
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        comment: v.optional(v.string()),
        decidedAt: v.optional(v.number()),
      }),
    ),
    resultingItemUpdates: v.array(
      v.object({
        itemId: v.id("items"),
        fromRevision: v.string(),
        toRevision: v.string(),
      }),
    ),
    releaseNote: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("implemented"), v.literal("closed")),
    createdByProfileId: v.id("userProfiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_and_changeRequest", ["organizationId", "changeRequestId"])
    .index("by_org_and_ecoNumber", ["organizationId", "ecoNumber"])
    .index("by_org_and_status", ["organizationId", "status"]),

  approvals: defineTable({
    organizationId: v.id("organizations"),
    changeRequestId: v.id("changeRequests"),
    profileId: v.id("userProfiles"),
    category: v.string(),
    decision: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    comment: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_and_changeRequest", ["organizationId", "changeRequestId"])
    .index("by_changeRequest_and_profile", ["changeRequestId", "profileId"])
    .index("by_org_and_decision", ["organizationId", "decision"]),

  comments: defineTable({
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
    parentCommentId: v.optional(v.id("comments")),
    body: v.string(),
    authorProfileId: v.id("userProfiles"),
    mentionProfileIds: v.array(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_and_entity", ["organizationId", "entityType", "entityId"])
    .index("by_parent", ["parentCommentId"])
    .index("by_org_and_createdAt", ["organizationId", "createdAt"]),

  attachments: defineTable({
    organizationId: v.id("organizations"),
    entityType: v.union(v.literal("changeRequest"), v.literal("eco")),
    entityId: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    uploadedByProfileId: v.id("userProfiles"),
    createdAt: v.number(),
  })
    .index("by_org_and_entity", ["organizationId", "entityType", "entityId"])
    .index("by_org_and_createdAt", ["organizationId", "createdAt"]),

  notifications: defineTable({
    organizationId: v.id("organizations"),
    recipientProfileId: v.id("userProfiles"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient_and_createdAt", ["recipientProfileId", "createdAt"])
    .index("by_recipient_and_isRead", ["recipientProfileId", "isRead"])
    .index("by_org_and_createdAt", ["organizationId", "createdAt"]),

  auditLogs: defineTable({
    organizationId: v.id("organizations"),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    actorProfileId: v.optional(v.id("userProfiles")),
    timestamp: v.number(),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    comment: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
  })
    .index("by_org_and_timestamp", ["organizationId", "timestamp"])
    .index("by_org_and_entity", ["organizationId", "entityType", "entityId"])
    .index("by_org_and_action", ["organizationId", "action"]),

  itemImports: defineTable({
    organizationId: v.id("organizations"),
    fileName: v.string(),
    uploadedByProfileId: v.id("userProfiles"),
    totalRows: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    errorCount: v.number(),
    errors: v.array(
      v.object({
        rowNumber: v.number(),
        itemNumber: v.optional(v.string()),
        message: v.string(),
      }),
    ),
    createdAt: v.number(),
  }).index("by_org_and_createdAt", ["organizationId", "createdAt"]),
});
