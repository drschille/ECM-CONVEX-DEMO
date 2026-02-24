import { mutation, query } from "./_generated/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const email = identity.email ?? "";
    return {
      tokenIdentifier: identity.tokenIdentifier,
      email,
      name: identity.name ?? email.split("@")[0] ?? "User",
      subject: identity.subject,
    };
  },
});

export const bootstrapProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const email = identity.email ?? identity.tokenIdentifier;
    const name = identity.name ?? email.split("@")[0] ?? "User";

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch("userProfiles", existing._id, {
        authUserId: identity.tokenIdentifier,
        lastSeenAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      authUserId: identity.tokenIdentifier,
      email,
      name,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const email = identity.email ?? identity.tokenIdentifier;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});
