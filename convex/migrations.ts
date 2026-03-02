import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function toInt64(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  return null;
}

export const auditTemporalNumberFields = query({
  args: {},
  handler: async (ctx) => {
    let changeRequests = 0;
    let changeNotices = 0;
    let changeRequestSequences = 0;
    let changeNoticeSequences = 0;
    let sequencePrefixSettings = 0;
    let changeRequestLinks = 0;
    let requestImpactAnalysisSuggestionsCreatedAt = 0;
    let requestImpactAnalysisSuggestionsResolvedAt = 0;

    const requestRows = await ctx.db.query("changeRequests").collect();
    for (const row of requestRows) {
      if (typeof row.year === "number" || typeof row.timestamp === "number") {
        changeRequests += 1;
      }
    }

    const noticeRows = await ctx.db.query("changeNotices").collect();
    for (const row of noticeRows) {
      if (typeof row.year === "number" || typeof row.timestamp === "number") {
        changeNotices += 1;
      }
    }

    const requestSeqRows = await ctx.db.query("changeRequestSequences").collect();
    for (const row of requestSeqRows) {
      if (typeof row.year === "number") {
        changeRequestSequences += 1;
      }
    }

    const noticeSeqRows = await ctx.db.query("changeNoticeSequences").collect();
    for (const row of noticeSeqRows) {
      if (typeof row.year === "number") {
        changeNoticeSequences += 1;
      }
    }

    const prefixRows = await ctx.db.query("sequencePrefixSettings").collect();
    for (const row of prefixRows) {
      if (typeof row.updatedAt === "number") {
        sequencePrefixSettings += 1;
      }
    }

    const linkRows = await ctx.db.query("changeRequestLinks").collect();
    for (const row of linkRows) {
      if (typeof row.createdAt === "number") {
        changeRequestLinks += 1;
      }
    }

    const suggestionRows = await ctx.db.query("requestImpactAnalysisSuggestions").collect();
    for (const row of suggestionRows) {
      if (typeof row.createdAt === "number") {
        requestImpactAnalysisSuggestionsCreatedAt += 1;
      }
      if (typeof row.resolvedAt === "number") {
        requestImpactAnalysisSuggestionsResolvedAt += 1;
      }
    }

    return {
      changeRequests,
      changeNotices,
      changeRequestSequences,
      changeNoticeSequences,
      sequencePrefixSettings,
      changeRequestLinks,
      requestImpactAnalysisSuggestionsCreatedAt,
      requestImpactAnalysisSuggestionsResolvedAt,
    };
  },
});

export const normalizeTemporalNumberFields = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    let patched = 0;

    const requestRows = await ctx.db.query("changeRequests").collect();
    for (const row of requestRows) {
      const patch: Record<string, bigint> = {};
      const year = toInt64(row.year);
      const timestamp = toInt64(row.timestamp);
      if (year !== null) patch.year = year;
      if (timestamp !== null) patch.timestamp = timestamp;
      if (Object.keys(patch).length > 0) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("changeRequests", row._id, patch);
      }
    }

    const noticeRows = await ctx.db.query("changeNotices").collect();
    for (const row of noticeRows) {
      const patch: Record<string, bigint> = {};
      const year = toInt64(row.year);
      const timestamp = toInt64(row.timestamp);
      if (year !== null) patch.year = year;
      if (timestamp !== null) patch.timestamp = timestamp;
      if (Object.keys(patch).length > 0) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("changeNotices", row._id, patch);
      }
    }

    const requestSeqRows = await ctx.db.query("changeRequestSequences").collect();
    for (const row of requestSeqRows) {
      const year = toInt64(row.year);
      if (year !== null) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("changeRequestSequences", row._id, { year });
      }
    }

    const noticeSeqRows = await ctx.db.query("changeNoticeSequences").collect();
    for (const row of noticeSeqRows) {
      const year = toInt64(row.year);
      if (year !== null) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("changeNoticeSequences", row._id, { year });
      }
    }

    const prefixRows = await ctx.db.query("sequencePrefixSettings").collect();
    for (const row of prefixRows) {
      const updatedAt = toInt64(row.updatedAt);
      if (updatedAt !== null) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("sequencePrefixSettings", row._id, { updatedAt });
      }
    }

    const linkRows = await ctx.db.query("changeRequestLinks").collect();
    for (const row of linkRows) {
      const createdAt = toInt64(row.createdAt);
      if (createdAt !== null) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("changeRequestLinks", row._id, { createdAt });
      }
    }

    const suggestionRows = await ctx.db.query("requestImpactAnalysisSuggestions").collect();
    for (const row of suggestionRows) {
      const patch: Record<string, bigint> = {};
      const createdAt = toInt64(row.createdAt);
      const resolvedAt = toInt64(row.resolvedAt);
      if (createdAt !== null) patch.createdAt = createdAt;
      if (resolvedAt !== null) patch.resolvedAt = resolvedAt;
      if (Object.keys(patch).length > 0) {
        patched += 1;
        if (!dryRun) await ctx.db.patch("requestImpactAnalysisSuggestions", row._id, patch);
      }
    }

    return { patched, dryRun };
  },
});
