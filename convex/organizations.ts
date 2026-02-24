import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActor, requireOrgRole } from "./lib/authz";

function sanitizeOrgOwnerName(name: string): string {
  const cleaned = name
    .replace(/^https?:\/\/[^|]+\|?/, "")
    .replace(/\|.*/, "")
    .replace(/[^a-zA-Z0-9 _.-]/g, " ")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "My";
}

function defaultOrganizationName(profile: { name: string }): string {
  const owner = sanitizeOrgOwnerName(profile.name);
  return `${owner}'s Organization`;
}

function defaultOrganizationSlugBase(profile: { email: string; name: string }): string {
  const email = profile.email.trim().toLowerCase();
  const emailLocal = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? (email.split("@")[0] ?? "")
    : "";
  const base = (emailLocal || sanitizeOrgOwnerName(profile.name)).toLowerCase();
  const slug = base.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || "org";
}

function looksLikeUglyAutoOrgName(name: string): boolean {
  return (
    name.endsWith("'s Organization") &&
    (name.includes("convex.site|") || /^https?:\/\//.test(name) || name.includes("|"))
  );
}

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
          const organization = await ctx.db.get("organizations", membership.organizationId);
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
    const org = await ctx.db.get("organizations", args.organizationId);
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
      const first = memberships.find((m) => m.isActive) ?? memberships[0];
      if (!first) return null;
      const org = await ctx.db.get("organizations", first.organizationId);
      if (org && looksLikeUglyAutoOrgName(org.name) && org.createdByProfileId === profile._id) {
        await ctx.db.patch("organizations", org._id, {
          name: defaultOrganizationName(profile),
          updatedAt: Date.now(),
        });
      }
      return first.organizationId;
    }

    const baseSlug = defaultOrganizationSlugBase(profile);
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
      name: defaultOrganizationName(profile),
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
        profile: await ctx.db.get("userProfiles", membership.profileId),
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
    const membership = await ctx.db.get("memberships", args.membershipId);
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

export const addMemberByEmail = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("engineer"),
      v.literal("approver"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireOrgRole(ctx, args.organizationId, ["admin"]);
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError({ code: "VALIDATION", message: "Invalid email address" });
    }
    const now = Date.now();
    const fallbackName = email.split("@")[0] ?? "User";
    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        email,
        name: args.name?.trim() || fallbackName,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
      profile = await ctx.db.get("userProfiles", profileId);
    } else if (args.name?.trim() && profile.name !== args.name.trim()) {
      await ctx.db.patch("userProfiles", profile._id, {
        name: args.name.trim(),
        updatedAt: now,
      });
      profile = await ctx.db.get("userProfiles", profile._id);
    }

    if (!profile) {
      throw new ConvexError({ code: "INTERNAL", message: "Failed to provision profile" });
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_and_profile", (q) =>
        q.eq("organizationId", args.organizationId).eq("profileId", profile._id),
      )
      .unique();

    if (existingMembership) {
      await ctx.db.patch("memberships", existingMembership._id, {
        role: args.role,
        isActive: true,
        updatedAt: now,
      });
      return {
        membershipId: existingMembership._id,
        profileId: profile._id,
        email: profile.email,
        role: args.role,
        created: false,
        updated: true,
      };
    }

    const membershipId = await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      profileId: profile._id,
      role: args.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      membershipId,
      profileId: profile._id,
      email: profile.email,
      role: args.role,
      created: true,
      updated: false,
      invitedByProfileId: actor.profile._id,
    };
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
