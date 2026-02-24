import { mutation, query } from "./_generated/server";

function authIdentityCandidates(identity: {
  subject: string;
  tokenIdentifier: string;
}): { stableKey: string; candidates: string[] } {
  const tokenParts = identity.tokenIdentifier.split("|").filter(Boolean);
  const subjectParts = identity.subject.split("|").filter(Boolean);
  const nonUrlTokenParts = tokenParts.filter((part) => !/^https?:\/\//.test(part));
  const stableKey =
    nonUrlTokenParts[0] ??
    subjectParts[0] ??
    identity.subject ??
    identity.tokenIdentifier;
  const candidates = [
    stableKey,
    ...nonUrlTokenParts,
    ...subjectParts,
    identity.subject,
    identity.tokenIdentifier,
  ].filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index);
  return { stableKey, candidates };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeFallbackName(input: string): string {
  const noUrl = input.replace(/^https?:\/\/[^|]+\|?/, "");
  const firstSegment = noUrl.split("|")[0] ?? noUrl;
  const localPart = firstSegment.split("@")[0] ?? firstSegment;
  const cleaned = localPart
    .replace(/[^a-zA-Z0-9 _.-]/g, " ")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "User";
  return cleaned.length > 40 ? cleaned.slice(0, 40).trim() : cleaned;
}

function profileFieldsFromIdentity(identity: {
  email?: string | null;
  name?: string | null;
  tokenIdentifier: string;
  subject: string;
}) {
  const { stableKey } = authIdentityCandidates(identity);
  const rawEmail = identity.email?.trim() ?? "";
  const email = rawEmail || `user-${stableKey}@auth.local`;
  const rawName = identity.name?.trim() ?? "";
  const name = rawName || sanitizeFallbackName(isEmail(email) ? email : identity.tokenIdentifier);
  return { email, name };
}

function looksLikeGeneratedGarbageName(name: string): boolean {
  return name.includes("convex.site|") || name.includes("|") || /^https?:\/\//.test(name);
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const { email, name } = profileFieldsFromIdentity(identity);
    return {
      tokenIdentifier: identity.tokenIdentifier,
      email: isEmail(email) ? email : "",
      name,
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
    const { email, name } = profileFieldsFromIdentity(identity);
    const { stableKey, candidates } = authIdentityCandidates(identity);

    let existingByAuth = null as Awaited<
      ReturnType<ReturnType<typeof ctx.db.query<"userProfiles">>["unique"]>
    >;
    for (const candidate of candidates) {
      // Migrate from older identifier choices (tokenIdentifier/subject) to stable account key.
      const found = await ctx.db
        .query("userProfiles")
        .withIndex("by_auth_user_id", (q) => q.eq("authUserId", candidate))
        .unique();
      if (found) {
        existingByAuth = found;
        break;
      }
    }

    if (existingByAuth) {
      await ctx.db.patch("userProfiles", existingByAuth._id, {
        email,
        name:
          identity.name?.trim() || looksLikeGeneratedGarbageName(existingByAuth.name)
            ? name
            : existingByAuth.name,
        authUserId: stableKey,
        lastSeenAt: now,
        updatedAt: now,
      });
      return existingByAuth._id;
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch("userProfiles", existing._id, {
        email,
        name:
          identity.name?.trim() || looksLikeGeneratedGarbageName(existing.name)
            ? name
            : existing.name,
        authUserId: stableKey,
        lastSeenAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      authUserId: stableKey,
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
    const { candidates } = authIdentityCandidates(identity);
    for (const candidate of candidates) {
      const byAuth = await ctx.db
        .query("userProfiles")
        .withIndex("by_auth_user_id", (q) => q.eq("authUserId", candidate))
        .unique();
      if (byAuth) return byAuth;
    }
    const { email } = profileFieldsFromIdentity(identity);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});
