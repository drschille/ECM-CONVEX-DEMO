import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "./domain";

type Ctx = QueryCtx | MutationCtx;

export type Actor = {
  identity: Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>;
  profile: {
    _id: Id<"userProfiles">;
    email: string;
    name: string;
  };
};

export type MembershipWithRole = {
  _id: Id<"memberships">;
  role: Role;
  organizationId: Id<"organizations">;
  profileId: Id<"userProfiles">;
};

function unauthorized(message: string): never {
  throw new ConvexError({ code: "UNAUTHORIZED", message });
}

function forbidden(message: string): never {
  throw new ConvexError({ code: "FORBIDDEN", message });
}

export async function requireActor(ctx: Ctx): Promise<Actor> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    unauthorized("Authentication required.");
  }

  const byToken = await ctx.db
    .query("userProfiles")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", identity.subject as Id<"users">))
    .unique();

  if (byToken) {
    return {
      identity,
      profile: {
        _id: byToken._id,
        email: byToken.email,
        name: byToken.name,
      },
    };
  }

  const email = identity.email ?? identity.tokenIdentifier;
  const byEmail = await ctx.db
    .query("userProfiles")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (!byEmail) {
    unauthorized(
      "No user profile found. Call users.bootstrapProfile after sign-in before using ECM APIs.",
    );
  }

  return {
    identity,
    profile: {
      _id: byEmail._id,
      email: byEmail.email,
      name: byEmail.name,
    },
  };
}

export async function requireMembership(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<MembershipWithRole> {
  const actor = await requireActor(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_and_profile", (q) =>
      q.eq("organizationId", organizationId).eq("profileId", actor.profile._id),
    )
    .unique();

  if (!membership || !membership.isActive) {
    forbidden("You do not have access to this organization.");
  }

  return {
    _id: membership._id,
    role: membership.role,
    organizationId: membership.organizationId,
    profileId: membership.profileId,
  };
}

export async function requireOrgRole(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  allowedRoles: Role[],
): Promise<{ actor: Actor; membership: MembershipWithRole }> {
  const actor = await requireActor(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_and_profile", (q) =>
      q.eq("organizationId", organizationId).eq("profileId", actor.profile._id),
    )
    .unique();

  if (!membership || !membership.isActive) {
    forbidden("You do not have access to this organization.");
  }
  if (!allowedRoles.includes(membership.role)) {
    forbidden(`Role ${membership.role} does not have permission for this action.`);
  }

  return {
    actor,
    membership: {
      _id: membership._id,
      role: membership.role,
      organizationId: membership.organizationId,
      profileId: membership.profileId,
    },
  };
}
