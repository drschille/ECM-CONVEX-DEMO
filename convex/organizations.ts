import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActor, requireOrgRole } from "./lib/authz";

async function createOrganizationInternal(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  args: {
    name: string;
    slug: string;
    description?: string;
    profileId: Id<"userProfiles">;
  },
) {
  const now = Date.now();
  const organizationId = await ctx.db.insert("organizations", {
    slug: args.slug,
    name: args.name.trim(),
    description: args.description?.trim(),
    createdByProfileId: args.profileId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("memberships", {
    organizationId,
    profileId: args.profileId,
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("approvalPolicies", {
    organizationId,
    minApproverCount: 1,
    extraSignoffCategories: [],
    active: true,
    createdByProfileId: args.profileId,
    createdAt: now,
    updatedAt: now,
  });
  return organizationId;
}

export const listMyOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActor(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", actor.profile._id))
      .collect();

    const rows = await Promise.all(
      memberships
        .filter((m) => m.isActive)
        .map(async (membership) => {
          const organization = await ctx.db.get(membership.organizationId);
          if (!organization) return null;
          return {
            membershipId: membership._id,
            organizationId: organization._id,
            name: organization.name,
            slug: organization.slug,
            role: membership.role,
          };
        }),
    );

    return rows.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { membership } = await requireOrgRole(ctx, args.organizationId, [
      "admin",
      "engineer",
      "approver",
      "viewer",
    ]);
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }
    return { ...org, myRole: membership.role };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireActor(ctx);
    const slug = args.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,50}$/.test(slug)) {
      throw new ConvexError({ code: "VALIDATION", message: "Invalid organization slug" });
    }

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Organization slug already exists" });
    }

    return await createOrganizationInternal(ctx, {
      name: args.name,
      slug,
      description: args.description,
      profileId: profile._id,
    });
  },
});

export const bootstrapDefaultOrganization = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActor(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();
    if (memberships.some((m) => m.isActive)) {
      return memberships[0]?.organizationId ?? null;
    }

    const baseSlug = profile.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "org";
    let slug = `${baseSlug}-ecm`;
    let suffix = 1;
    while (
      await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      suffix += 1;
      slug = `${baseSlug}-ecm-${suffix}`;
    }

    const orgId = await createOrganizationInternal(ctx, {
      name: `${profile.name}'s Organization`,
      slug,
      description: "Default ECM organization",
      profileId: profile._id,
    });
    return orgId as Id<"organizations">;
  },
});

export const listMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    const profiles = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        profile: await ctx.db.get(membership.profileId),
      })),
    );
    return profiles
      .filter((row) => row.profile)
      .map((row) => ({
        membershipId: row.membership._id,
        profileId: row.membership.profileId,
        role: row.membership.role,
        isActive: row.membership.isActive,
        email: row.profile!.email,
        name: row.profile!.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const updateMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipId: v.id("memberships"),
    role: v.union(
      v.literal("admin"),
      v.literal("engineer"),
      v.literal("approver"),
      v.literal("viewer"),
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin"]);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.organizationId !== args.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Membership not found" });
    }
    if (membership.profileId === actor.profile._id && args.role !== "admin") {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Admins cannot demote themselves from the organization settings page.",
      });
    }
    await ctx.db.patch("memberships", membership._id, {
      role: args.role,
      isActive: args.isActive ?? membership.isActive,
      updatedAt: Date.now(),
    });
    return membership._id;
  },
});

export const getApprovalPolicy = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.organizationId, ["admin", "engineer", "approver", "viewer"]);
    return await ctx.db
      .query("approvalPolicies")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("active", true),
      )
      .unique();
  },
});

export const upsertApprovalPolicy = mutation({
  args: {
    organizationId: v.id("organizations"),
    minApproverCount: v.number(),
    extraSignoffCategories: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("approvalPolicies")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("active", true),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("approvalPolicies", existing._id, {
        minApproverCount: Math.max(1, Math.floor(args.minApproverCount)),
        extraSignoffCategories: args.extraSignoffCategories.map((c) => c.trim()).filter(Boolean),
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("approvalPolicies", {
      organizationId: args.organizationId,
      minApproverCount: Math.max(1, Math.floor(args.minApproverCount)),
      extraSignoffCategories: args.extraSignoffCategories.map((c) => c.trim()).filter(Boolean),
      active: true,
      createdByProfileId: actor.profile._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});
