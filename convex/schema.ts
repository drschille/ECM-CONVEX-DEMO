import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  changeNotices: defineTable({
    id: v.string(),
    author: v.string(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    description: v.string(),
    timestamp: v.int64(),
    year: v.int64(),
    state: v.union(
      v.literal("proposed"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  }).index("change_notices_by_year", ["year", "id", "timestamp"]),
  changeRequests: defineTable({
    id: v.string(),
    author: v.string(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    description: v.string(),
    timestamp: v.int64(),
    year: v.int64(),
    state: v.union(
      v.literal("proposed"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  }).index("change_requests_by_year", ["year", "id", "timestamp"]),
  changeRequestSequences: defineTable({
    year: v.int64(),
    lastNumber: v.number(),
  }).index("by_year", ["year"]),
  changeNoticeSequences: defineTable({
    year: v.int64(),
    lastNumber: v.number(),
  }).index("by_year", ["year"]),
  sequencePrefixSettings: defineTable({
    sequenceType: v.union(
      v.literal("changeRequest"),
      v.literal("changeNotification"),
    ),
    prefix: v.string(),
    updatedAt: v.int64(),
    updatedBy: v.string(),
  }).index("by_sequence_type", ["sequenceType"]),
  changeRequestTargets: defineTable({
    changeRequestId: v.id("changeRequests"),
    itemId: v.id("items"),
    targetRole: v.union(
      v.literal("direct"),
      v.literal("impacted"),
      v.literal("candidate"),
    ),
    changeType: v.union(
      v.literal("add"),
      v.literal("modify"),
      v.literal("remove"),
      v.literal("replace"),
      v.literal("review_only"),
    ),
    notes: v.optional(v.string()),
    plannedRevisionFrom: v.optional(v.string()),
    plannedRevisionTo: v.optional(v.string()),
  })
    .index("by_change_request", ["changeRequestId"])
    .index("by_item", ["itemId"])
    .index("by_change_request_role", ["changeRequestId", "targetRole"]),
  changeRequestLinks: defineTable({
    parentChangeRequestId: v.id("changeRequests"),
    childChangeRequestId: v.id("changeRequests"),
    reason: v.union(
      v.literal("depends_on"),
      v.literal("derived_from"),
      v.literal("follow_up_for_subassembly"),
      v.literal("split_scope"),
      v.literal("related"),
    ),
    createdAt: v.int64(),
    createdBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_parent", ["parentChangeRequestId"])
    .index("by_child", ["childChangeRequestId"]),
  requestImpactAnalysisSuggestions: defineTable({
    changeRequestId: v.id("changeRequests"),
    sourceItemId: v.optional(v.id("items")),
    suggestionType: v.union(
      v.literal("create_follow_up_ecn"),
      v.literal("add_missing_item_record"),
      v.literal("add_impacted_target"),
      v.literal("review_subassembly"),
    ),
    suggestedItemId: v.optional(v.id("items")),
    suggestedPartNumber: v.optional(v.string()),
    suggestedDrawingNumber: v.optional(v.string()),
    suggestedName: v.optional(v.string()),
    reason: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("accepted"),
      v.literal("dismissed"),
      v.literal("superseded"),
    ),
    createdChangeRequestId: v.optional(v.id("changeRequests")),
    createdAt: v.int64(),
    resolvedAt: v.optional(v.int64()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_change_request", ["changeRequestId", "status"])
    .index("by_source_item", ["sourceItemId"])
    .index("by_created_change_request", ["createdChangeRequestId"]),
  products: defineTable({
    productNumber: v.string(),
    drawingNumber: v.string(),
    revision: v.string(),
    name: v.string(),
    bom: v.array(
      v.object({
        itemId: v.id("items"),
        quantity: v.number(),
      }),
    ),
  })
  .index("by_product_number", ["productNumber"])
  .index("by_drawing_number", ["drawingNumber"]),
  items: defineTable({
    partNumber: v.string(),
    drawingNumbers: v.array(v.string()),
    revision: v.string(),
    name: v.string(),
    description: v.string(),
    itemType: v.union(
      v.literal("product"),
      v.literal("raw material"),
      v.literal("service"),
    ),
  })
  .index("by_part_number", ["partNumber"]),
});
