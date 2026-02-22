import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function formatSuggestedChangeNoticeId(year: number, sequence: number) {
    return `P${year}-${String(sequence).padStart(4, "0")}`;
}

function parseSequenceFromId(id: string, year: number) {
    const dashedPrefix = `P${year}-`;
    const legacyPrefix = `P${year}`;
    let suffix = "";

    if (id.startsWith(dashedPrefix)) {
        suffix = id.slice(dashedPrefix.length);
    } else if (id.startsWith(legacyPrefix)) {
        // Backward-compatible parsing for older IDs like P20260001.
        suffix = id.slice(legacyPrefix.length);
    } else {
        return null;
    }

    if (!/^\d{1,4}$/.test(suffix)) {
        return null;
    }
    return Number(suffix);
}

async function getStoredSequence(ctx: { db: any }, year: number) {
    return await ctx.db
        .query("changeNoticeSequences")
        .withIndex("by_year", (q: any) => q.eq("year", year))
        .unique();
}

async function getBootstrappedLastSequence(ctx: { db: any }, year: number) {
    const sequence = await getStoredSequence(ctx, year);
    if (sequence) {
        return { row: sequence, lastNumber: sequence.lastNumber };
    }

    const noticesForYear = await ctx.db
        .query("changeNotices")
        .withIndex("change_notices_by_year", (q: any) => q.eq("year", year))
        .collect();
    const maxExistingSequence = noticesForYear.reduce((max: number, notice: { id: string }) => {
        const parsed = parseSequenceFromId(notice.id, year);
        return parsed !== null ? Math.max(max, parsed) : max;
    }, 0);

    return { row: null, lastNumber: maxExistingSequence };
}

async function requireUserIdentity(ctx: { auth: any }) {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}

async function createChangeNoticeWithNextId(
    ctx: { db: any },
    params: { description?: string; author: string; now?: number },
) {
    const now = params.now ?? Date.now();
    const year = new Date(now).getFullYear();
    const { row: sequenceRow, lastNumber } = await getBootstrappedLastSequence(ctx, year);
    let nextNumber = lastNumber + 1;
    let id = formatSuggestedChangeNoticeId(year, nextNumber);

    while (true) {
        if (nextNumber > 9999) {
            throw new Error(`Change notice sequence overflow for ${year}`);
        }

        const existing = await ctx.db
            .query("changeNotices")
            .withIndex("change_notices_by_year", (q: any) =>
                q.eq("year", year).eq("id", id)
            )
            .unique();
        if (!existing) {
            break;
        }

        // Recover from an out-of-sync sequence row by advancing forward only.
        nextNumber += 1;
        id = formatSuggestedChangeNoticeId(year, nextNumber);
    }

    if (sequenceRow) {
        await ctx.db.patch("changeNoticeSequences", sequenceRow._id, {
            lastNumber: nextNumber,
        });
    } else {
        await ctx.db.insert("changeNoticeSequences", {
            year,
            lastNumber: nextNumber,
        });
    }

    const noticeId = await ctx.db.insert("changeNotices", {
        id,
        author: params.author,
        description: params.description ?? "",
        timestamp: now,
        year,
        state: "proposed"
    });

    return { noticeId, id, year };
}

export const changeNotices = query({
    args: { year: v.optional(v.number()) },
    handler: async (ctx, args) => {
       
        // Default to the current year if no year is provided
        const year = args.year ?? new Date().getFullYear();

        const notices = await ctx.db
            .query("changeNotices")
            .withIndex("change_notices_by_year", (q) =>
                q.eq("year", year)
            )
            .order("asc")
            .take(100);
        return notices;
    },
});

export const nextChangeNoticeId = query({
    args: { year: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const year = args.year ?? new Date().getFullYear();
        const { lastNumber } = await getBootstrappedLastSequence(ctx, year);
        return formatSuggestedChangeNoticeId(year, lastNumber + 1);
    },
});

export const addChangeNotice = mutation({
    args: {
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await requireUserIdentity(ctx);
        const created = await createChangeNoticeWithNextId(ctx, {
            description: args.description,
            author: user.name ?? user.email ?? "Unknown",
        });
        return { id: created.id };
    },
});

export const addChangeNoticeTarget = mutation({
    args: {
        changeNoticeId: v.id("changeNotices"),
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
    },
    handler: async (ctx, args) => {
        await requireUserIdentity(ctx);

        const notice = await ctx.db.get("changeNotices", args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }
        const item = await ctx.db.get("items", args.itemId);
        if (!item) {
            throw new Error("Item not found");
        }

        const existingTargets = await ctx.db
            .query("changeNoticeTargets")
            .withIndex("by_change_notice", (q) => q.eq("changeNoticeId", args.changeNoticeId))
            .collect();
        const duplicate = existingTargets.find(
            (target) =>
                target.itemId === args.itemId &&
                target.targetRole === args.targetRole &&
                target.changeType === args.changeType,
        );
        if (duplicate) {
            return { targetId: duplicate._id, deduplicated: true };
        }

        const targetId = await ctx.db.insert("changeNoticeTargets", {
            changeNoticeId: args.changeNoticeId,
            itemId: args.itemId,
            targetRole: args.targetRole,
            changeType: args.changeType,
            notes: args.notes,
            plannedRevisionFrom: args.plannedRevisionFrom,
            plannedRevisionTo: args.plannedRevisionTo,
        });

        return { targetId, deduplicated: false };
    },
});

export const runImpactAnalysisForEcn = mutation({
    args: { changeNoticeId: v.id("changeNotices") },
    handler: async (ctx, args) => {
        await requireUserIdentity(ctx);
        const notice = await ctx.db.get("changeNotices", args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }

        // Starter stub: create a single open suggestion if there are no open suggestions yet.
        const existingOpen = await ctx.db
            .query("impactAnalysisSuggestions")
            .withIndex("by_change_notice", (q) =>
                q.eq("changeNoticeId", args.changeNoticeId).eq("status", "open")
            )
            .take(1);
        if (existingOpen.length > 0) {
            return { created: 0, message: "Open suggestions already exist for this ECN." };
        }

        const now = Date.now();
        await ctx.db.insert("impactAnalysisSuggestions", {
            changeNoticeId: args.changeNoticeId,
            suggestionType: "review_subassembly",
            reason: "Impact analysis stub: review nested product BOMs and create follow-up ECNs where needed.",
            status: "open",
            createdAt: now,
        });

        return { created: 1, message: "Created a starter impact-analysis suggestion." };
    },
});

export const acceptSuggestionCreateFollowUpEcn = mutation({
    args: {
        suggestionId: v.id("impactAnalysisSuggestions"),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await requireUserIdentity(ctx);
        const suggestion = await ctx.db.get("impactAnalysisSuggestions", args.suggestionId);
        if (!suggestion) {
            throw new Error("Suggestion not found");
        }
        if (suggestion.status !== "open") {
            throw new Error("Suggestion is not open");
        }
        if (suggestion.suggestionType !== "create_follow_up_ecn") {
            throw new Error("Suggestion is not a follow-up ECN suggestion");
        }

        const parentNotice = await ctx.db.get("changeNotices", suggestion.changeNoticeId);
        if (!parentNotice) {
            throw new Error("Parent change notice not found");
        }

        const now = Date.now();
        const created = await createChangeNoticeWithNextId(ctx, {
            description:
                args.description ??
                suggestion.reason ??
                `Follow-up change notice for ${parentNotice.id}`,
            author: user.name ?? user.email ?? "Unknown",
            now,
        });

        await ctx.db.insert("changeNoticeLinks", {
            parentChangeNoticeId: suggestion.changeNoticeId,
            childChangeNoticeId: created.noticeId,
            reason: "follow_up_for_subassembly",
            createdAt: now,
            createdBy: user.name ?? user.email ?? "Unknown",
        });

        if (suggestion.suggestedItemId) {
            await ctx.db.insert("changeNoticeTargets", {
                changeNoticeId: created.noticeId,
                itemId: suggestion.suggestedItemId,
                targetRole: "direct",
                changeType: "modify",
                notes: "Auto-added from accepted impact analysis suggestion.",
            });
        }

        await ctx.db.patch("impactAnalysisSuggestions", args.suggestionId, {
            status: "accepted",
            createdChangeNoticeId: created.noticeId,
            resolvedAt: now,
            resolvedBy: user.name ?? user.email ?? "Unknown",
        });

        return {
            changeNoticeId: created.noticeId,
            id: created.id,
        };
    },
});

export const startChangeNotice = mutation({
    args: { noticeId: v.id("changeNotices") },
    handler: async (ctx, args) => {
        await requireUserIdentity(ctx);

        const notice = await ctx.db.get("changeNotices", args.noticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }
        if (notice.state !== "proposed") {
            throw new Error("Only proposed change notices can be started");
        }

        await ctx.db.patch("changeNotices", args.noticeId, { state: "started" });
    },
});
