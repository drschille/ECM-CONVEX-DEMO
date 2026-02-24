import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActor } from "./lib/authz";
import { appendAuditLog, formatSequence, nextCounterValue } from "./lib/platform";
import { computeStatusSlaDueAt, toSearchText } from "./lib/domain";

async function getOrCreateCliSeedProfile(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  now: number,
): Promise<{ _id: Id<"userProfiles">; email: string; name: string }> {
  const email = "seed.bot@ecm.local";
  const name = "ECM Dev Seed Bot";
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  if (existing) {
    await ctx.db.patch("userProfiles", existing._id, { lastSeenAt: now, updatedAt: now });
    return { _id: existing._id, email: existing.email, name: existing.name };
  }
  const profileId = await ctx.db.insert("userProfiles", {
    email,
    name,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return { _id: profileId, email, name };
}

export const seedDemoData = mutation({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    if (!(process.env.CONVEX_DEPLOYMENT ?? "").startsWith("dev:")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Seeding is allowed only in Convex dev deployments.",
      });
    }

    const now = Date.now();
    let profile: { _id: Id<"userProfiles">; email: string; name: string };
    let seedMode: "authenticated" | "cli_fallback" = "authenticated";
    try {
      const actor = await requireActor(ctx);
      profile = actor.profile;
    } catch {
      // Allow CLI/dashboard seeding without auth only in dev deployments.
      seedMode = "cli_fallback";
      profile = await getOrCreateCliSeedProfile(ctx, now);
    }

    let organizationId = args.organizationId;
    if (!organizationId) {
      if (seedMode === "authenticated") {
        const existingMembership = await ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .first();
        organizationId = existingMembership?.organizationId;
      } else {
        const orgs = await ctx.db
          .query("organizations")
          .withIndex("by_updated_at", (q) => q)
          .order("desc")
          .take(2);
        if (orgs.length === 1) {
          organizationId = orgs[0]._id;
        } else {
          throw new ConvexError({
            code: "VALIDATION",
            message:
              "For CLI seeding without auth, pass organizationId explicitly unless exactly one organization exists.",
          });
        }
      }
    }
    if (!organizationId) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Pass an organizationId or create/bootstrap an organization first.",
      });
    }

    const org = await ctx.db.get("organizations", organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }

    const myMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_and_profile", (q) =>
        q.eq("organizationId", organizationId).eq("profileId", profile._id),
      )
      .unique();
    if (seedMode === "authenticated") {
      if (!myMembership || !myMembership.isActive || myMembership.role !== "admin") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Only an active org admin can seed demo data.",
        });
      }
    } else if (!myMembership) {
      await ctx.db.insert("memberships", {
        organizationId,
        profileId: profile._id,
        role: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    } else if (!myMembership.isActive || myMembership.role !== "admin") {
      await ctx.db.patch("memberships", myMembership._id, {
        role: "admin",
        isActive: true,
        updatedAt: now,
      });
    }

    const existingCrs = await ctx.db
      .query("changeRequests")
      .withIndex("by_org_and_updatedAt", (q) => q.eq("organizationId", organizationId))
      .take(1);
    if (existingCrs.length > 0) {
      return { organizationId, skipped: true, reason: "Organization already has change requests" };
    }

    const seedUsers = [
      { email: "engineer.demo@ecm.local", name: "Evelyn Engineer", role: "engineer" as const },
      { email: "approver.demo@ecm.local", name: "Arjun Approver", role: "approver" as const },
      { email: "viewer.demo@ecm.local", name: "Vera Viewer", role: "viewer" as const },
    ];

    const profileIdsByEmail = new Map<string, Id<"userProfiles">>();
    profileIdsByEmail.set(profile.email, profile._id);

    for (const seedUser of seedUsers) {
      let userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", seedUser.email))
        .unique();
      if (!userProfile) {
        const profileId = await ctx.db.insert("userProfiles", {
          email: seedUser.email,
          name: seedUser.name,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        });
        userProfile = await ctx.db.get("userProfiles", profileId);
      }
      if (!userProfile) continue;
      profileIdsByEmail.set(seedUser.email, userProfile._id);

      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_and_profile", (q) =>
          q.eq("organizationId", organizationId).eq("profileId", userProfile._id),
        )
        .unique();
      if (!membership) {
        await ctx.db.insert("memberships", {
          organizationId,
          profileId: userProfile._id,
          role: seedUser.role,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const itemSeeds = [
      {
        itemNumber: "PN-1001",
        name: "Motor Controller PCB",
        description: "Main board for actuator control logic",
        revision: "A",
        lifecycleState: "released" as const,
        tags: ["electronics", "pcb"],
      },
      {
        itemNumber: "DWG-2205",
        name: "Actuator Housing Drawing",
        description: "Mechanical drawing package for enclosure and mounts",
        revision: "03",
        lifecycleState: "released" as const,
        tags: ["mechanical", "drawing"],
      },
      {
        itemNumber: "SW-0310",
        name: "Control Firmware",
        description: "Embedded firmware image and release manifest",
        revision: "01",
        lifecycleState: "draft" as const,
        tags: ["software", "firmware"],
      },
    ];

    const itemIds: Id<"items">[] = [];
    for (const seed of itemSeeds) {
      const existing = await ctx.db
        .query("items")
        .withIndex("by_org_and_itemNumber", (q) =>
          q.eq("organizationId", organizationId).eq("itemNumber", seed.itemNumber),
        )
        .unique();
      if (existing) {
        itemIds.push(existing._id);
        continue;
      }
      const itemId = await ctx.db.insert("items", {
        organizationId,
        itemNumber: seed.itemNumber,
        name: seed.name,
        description: seed.description,
        revision: seed.revision,
        lifecycleState: seed.lifecycleState,
        tags: seed.tags,
        searchText: toSearchText([seed.itemNumber, seed.name, seed.description, ...seed.tags]),
        createdByProfileId: profile._id,
        createdAt: now,
        updatedAt: now,
      });
      itemIds.push(itemId);
    }

    const engineerId = profileIdsByEmail.get("engineer.demo@ecm.local") ?? profile._id;
    const approverId = profileIdsByEmail.get("approver.demo@ecm.local") ?? profile._id;
    const viewerId = profileIdsByEmail.get("viewer.demo@ecm.local") ?? profile._id;

    const crSeeds = [
      {
        title: "Increase thermal margin on motor controller PCB",
        description: "Replace voltage regulator and widen copper pours in hot zones.",
        reason: "Field tests showed thermal derating under sustained loads.",
        priority: "high" as const,
        changeType: "design" as const,
        status: "in_review" as const,
        ownerProfileId: engineerId,
        watcherProfileIds: [approverId, viewerId],
        affectedItemIds: [itemIds[0], itemIds[2]].filter(Boolean),
      },
      {
        title: "Correct actuator housing drawing tolerances",
        description: "Fix callout stack-up and GD&T notes on mounting bores.",
        reason: "Manufacturing NCR due to ambiguous tolerance interpretation.",
        priority: "medium" as const,
        changeType: "document" as const,
        status: "triage" as const,
        ownerProfileId: profile._id,
        watcherProfileIds: [viewerId],
        affectedItemIds: [itemIds[1]].filter(Boolean),
      },
      {
        title: "Firmware watchdog reset threshold adjustment",
        description: "Tune reset timeout and add logging to watchdog recovery path.",
        reason: "Intermittent resets in test rack during bus contention events.",
        priority: "critical" as const,
        changeType: "software" as const,
        status: "submitted" as const,
        ownerProfileId: engineerId,
        watcherProfileIds: [approverId],
        affectedItemIds: [itemIds[2]].filter(Boolean),
      },
    ];

    const createdCrIds: Id<"changeRequests">[] = [];
    for (const seed of crSeeds) {
      const seq = await nextCounterValue(ctx, organizationId, "cr");
      const crNumber = formatSequence("CR", seq);
      const crId = await ctx.db.insert("changeRequests", {
        organizationId,
        crNumber,
        title: seed.title,
        description: seed.description,
        reason: seed.reason,
        priority: seed.priority,
        changeType: seed.changeType,
        status: seed.status,
        ownerProfileId: seed.ownerProfileId,
        createdByProfileId: profile._id,
        watcherProfileIds: seed.watcherProfileIds,
        dueDate: now + 7 * 24 * 60 * 60 * 1000,
        statusEnteredAt: now,
        statusSlaDueAt: computeStatusSlaDueAt(seed.status, now, now + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });
      createdCrIds.push(crId);

      for (const itemId of seed.affectedItemIds) {
        const item = await ctx.db.get("items", itemId);
        if (!item) continue;
        await ctx.db.insert("changeRequestItems", {
          organizationId,
          changeRequestId: crId,
          itemId,
          itemNumberSnapshot: item.itemNumber,
          itemNameSnapshot: item.name,
          currentRevisionSnapshot: item.revision,
          createdAt: now,
        });
      }

      if (seed.status === "in_review") {
        await ctx.db.insert("approvals", {
          organizationId,
          changeRequestId: crId,
          profileId: approverId,
          category: "approver",
          decision: "approved",
          comment: "Seeded approval",
          decidedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      await ctx.db.insert("comments", {
        organizationId,
        entityType: "changeRequest",
        entityId: String(crId),
        body: `Seed comment for ${crNumber}. @${String(profile.email).split("@")[0]}`,
        authorProfileId: profile._id,
        mentionProfileIds: [profile._id],
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notifications", {
        organizationId,
        recipientProfileId: approverId,
        type: "seed",
        title: `${crNumber} seeded`,
        body: seed.title,
        relatedEntityType: "changeRequest",
        relatedEntityId: String(crId),
        isRead: false,
        createdAt: now,
      });
      await appendAuditLog(ctx, {
        organizationId,
        entityType: "changeRequest",
        entityId: String(crId),
        action: "seed_cr_created",
        actorProfileId: profile._id,
        toStatus: seed.status,
        metadata: { crNumber },
      });
    }

    await appendAuditLog(ctx, {
      organizationId,
      entityType: "organization",
      entityId: String(organizationId),
      action: "dev_seed_completed",
      actorProfileId: profile._id,
      metadata: { items: itemIds.length, changeRequests: createdCrIds.length },
    });

    return {
      organizationId,
      seedMode,
      createdItemCount: itemIds.length,
      createdChangeRequestCount: createdCrIds.length,
      createdChangeRequestIds: createdCrIds,
    };
  },
});
