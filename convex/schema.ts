import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    authUserId: v.optional(v.id("users")),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_auth_user_id", ["authUserId"]),

  organizations: defineTable({
    slug: v.string(),
    name: v.string(),
    createdByUserId: v.optional(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("userProfiles"),
    role: v.union(
      v.literal("admin"),
      v.literal("engineer"),
      v.literal("approver"),
      v.literal("viewer"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["organizationId", "userId"]),
});
