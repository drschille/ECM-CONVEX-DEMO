import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  changeNotices: defineTable({
    id: v.string(),
    author: v.string(),
    description: v.string(),
    timestamp: v.number(),
    year: v.number(),
    state: v.union(
      v.literal("proposed"),
      v.literal("started"),
      v.literal("completed"), 
      v.literal("cancelled")
    )
  }).index("change_notices_by_year", ["year", "id", "timestamp"]),
  changeNoticeSequences: defineTable({
    year: v.number(),
    lastNumber: v.number(),
  }).index("by_year", ["year"]),
  products: defineTable({
    productNumber: v.string(),
    drawingNumber: v.string(),
    revision: v.string(),
    name: v.string(),
    bom: v.array(
      v.object({
        partNumber: v.string(),
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
