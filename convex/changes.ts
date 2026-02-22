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
        const user = await ctx.auth.getUserIdentity();
        if (!user) {
            throw new Error("Unauthorized");
        }
        const now = Date.now();
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
                .withIndex("change_notices_by_year", (q) =>
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

        await ctx.db.insert("changeNotices", {
            id,
            author: user.name ?? user.email ?? "Unknown",
            description: args.description ?? "",
            timestamp: now,
            year,
            state: "proposed"
        });

        return { id };
    },
});

export const startChangeNotice = mutation({
    args: { noticeId: v.id("changeNotices") },
    handler: async (ctx, args) => {
        const user = await ctx.auth.getUserIdentity();
        if (!user) {
            throw new Error("Unauthorized");
        }

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
