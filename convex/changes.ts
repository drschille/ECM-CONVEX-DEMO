import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

type SequencePrefixType = "changeRequest" | "changeNotification";
type IntValue = bigint;

const DEFAULT_SEQUENCE_PREFIXES: Record<SequencePrefixType, string> = {
    changeRequest: "P",
    changeNotification: "P",
};

function normalizeSequencePrefix(prefix: string) {
    const normalized = prefix.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(normalized)) {
        throw new Error("Prefix must be 1-6 letters (A-Z).");
    }
    return normalized;
}

function formatSuggestedChangeNoticeId(prefix: string, year: number, sequence: number) {
    return `${prefix}${year}-${String(sequence).padStart(4, "0")}`;
}

function parseSequenceFromId(id: string, year: number) {
    const match = id.match(/^([A-Z]{1,6})(\d{4})-?(\d{1,4})$/);
    if (!match) {
        return null;
    }
    if (Number(match[2]) !== year) {
        return null;
    }
    return Number(match[3]);
}

async function getSequencePrefixRow(
    ctx: { db: any },
    sequenceType: SequencePrefixType,
) {
    return await ctx.db
        .query("sequencePrefixSettings")
        .withIndex("by_sequence_type", (q: any) => q.eq("sequenceType", sequenceType))
        .unique();
}

async function getSequencePrefix(ctx: { db: any }, sequenceType: SequencePrefixType) {
    const row = await getSequencePrefixRow(ctx, sequenceType);
    return row?.prefix ?? DEFAULT_SEQUENCE_PREFIXES[sequenceType];
}

function currentYearInt(): IntValue {
    return BigInt(new Date().getFullYear());
}

function nowInt(): IntValue {
    return BigInt(Date.now());
}

function intToNumber(value: IntValue) {
    return Number(value);
}

async function getStoredSequence(ctx: { db: any }, year: IntValue) {
    return await ctx.db
        .query("changeRequestSequences")
        .withIndex("by_year", (q: any) => q.eq("year", year))
        .unique();
}

async function getBootstrappedLastSequence(ctx: { db: any }, year: IntValue) {
    const sequence = await getStoredSequence(ctx, year);
    if (sequence) {
        return { row: sequence, lastNumber: sequence.lastNumber };
    }

    const noticesForYear = await ctx.db
        .query("changeRequests")
        .withIndex("change_requests_by_year", (q: any) => q.eq("year", year))
        .collect();
    const yearNumber = intToNumber(year);
    const maxExistingSequence = noticesForYear.reduce((max: number, notice: { id: string }) => {
        const parsed = parseSequenceFromId(notice.id, yearNumber);
        return parsed !== null ? Math.max(max, parsed) : max;
    }, 0);

    return { row: null, lastNumber: maxExistingSequence };
}

async function getStoredNoticeSequence(ctx: { db: any }, year: IntValue) {
    return await ctx.db
        .query("changeNoticeSequences")
        .withIndex("by_year", (q: any) => q.eq("year", year))
        .unique();
}

async function getBootstrappedLastNoticeSequence(ctx: { db: any }, year: IntValue) {
    const sequence = await getStoredNoticeSequence(ctx, year);
    if (sequence) {
        return { row: sequence, lastNumber: sequence.lastNumber };
    }

    const noticesForYear = await ctx.db
        .query("changeNotices")
        .withIndex("change_notices_by_year", (q: any) => q.eq("year", year))
        .collect();
    const yearNumber = intToNumber(year);
    const maxExistingSequence = noticesForYear.reduce((max: number, notice: { id: string }) => {
        const parsed = parseSequenceFromId(notice.id, yearNumber);
        return parsed !== null ? Math.max(max, parsed) : max;
    }, 0);

    return { row: null, lastNumber: maxExistingSequence };
}

function getAuthorFields(user?: { name?: string | null; email?: string | null; subject?: string | null }) {
    const displayAuthor = user?.name ?? user?.email ?? "Anonymous";
    return {
        author: displayAuthor,
        authorName: user?.name ?? undefined,
        authorEmail: user?.email ?? undefined,
    };
}

async function getCurrentAuthorFields(_ctx: { db: any }) {
    return getAuthorFields();
}

async function createChangeNoticeWithNextId(
    ctx: { db: any },
    params: { description?: string; author: string; authorName?: string; authorEmail?: string; now?: IntValue },
) {
    const now = params.now ?? nowInt();
    const year = BigInt(new Date(intToNumber(now)).getFullYear());
    const yearNumber = intToNumber(year);
    const prefix = await getSequencePrefix(ctx, "changeRequest");
    const { row: sequenceRow, lastNumber } = await getBootstrappedLastSequence(ctx, year);
    let nextNumber = lastNumber + 1;
    let id = formatSuggestedChangeNoticeId(prefix, yearNumber, nextNumber);

    while (true) {
        if (nextNumber > 9999) {
            throw new Error(`Change notice sequence overflow for ${yearNumber}`);
        }

        const existing = await ctx.db
            .query("changeRequests")
            .withIndex("change_requests_by_year", (q: any) =>
                q.eq("year", year).eq("id", id)
            )
            .unique();
        if (!existing) {
            break;
        }

        // Recover from an out-of-sync sequence row by advancing forward only.
        nextNumber += 1;
        id = formatSuggestedChangeNoticeId(prefix, yearNumber, nextNumber);
    }

    if (sequenceRow) {
        await ctx.db.patch("changeRequestSequences", sequenceRow._id, {
            lastNumber: nextNumber,
        });
    } else {
        await ctx.db.insert("changeRequestSequences", {
            year,
            lastNumber: nextNumber,
        });
    }

    const noticeId = await ctx.db.insert("changeRequests", {
        id,
        author: params.author,
        authorName: params.authorName,
        authorEmail: params.authorEmail,
        description: params.description ?? "",
        timestamp: now,
        year,
        state: "proposed"
    });

    return { noticeId, id, year };
}

async function createChangeNotificationWithNextId(
    ctx: { db: any },
    params: { description?: string; author: string; authorName?: string; authorEmail?: string; now?: IntValue },
) {
    const now = params.now ?? nowInt();
    const year = BigInt(new Date(intToNumber(now)).getFullYear());
    const yearNumber = intToNumber(year);
    const prefix = await getSequencePrefix(ctx, "changeNotification");
    const { row: sequenceRow, lastNumber } = await getBootstrappedLastNoticeSequence(ctx, year);
    let nextNumber = lastNumber + 1;
    let id = formatSuggestedChangeNoticeId(prefix, yearNumber, nextNumber);

    while (true) {
        if (nextNumber > 9999) {
            throw new Error(`Change notice sequence overflow for ${yearNumber}`);
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

        nextNumber += 1;
        id = formatSuggestedChangeNoticeId(prefix, yearNumber, nextNumber);
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
        authorName: params.authorName,
        authorEmail: params.authorEmail,
        description: params.description ?? "",
        timestamp: now,
        year,
        state: "proposed",
    });

    return { noticeId, id, year };
}

export const changeRequests = query({
    args: {
        year: v.optional(v.int64()),
        paginationOpts: paginationOptsValidator
    },
    returns: v.object({
        page: v.array(
            v.object({
                _id: v.id("changeRequests"),
                id: v.string(),
                description: v.string(),
                author: v.optional(v.string()),
                authorName: v.optional(v.string()),
                authorEmail: v.optional(v.string()),
                timestamp: v.int64(),
                year: v.int64(),
                state: v.union(v.literal("proposed"), v.literal("started"), v.literal("completed"), v.literal("cancelled")),
                _creationTime: v.number(),
            })
        ),
        isDone: v.boolean(),
        continueCursor: v.union(v.string(), v.null()),
    }),
    handler: async (ctx, args) => {
        const year = args.year ?? currentYearInt();
        const result = await ctx.db
            .query("changeRequests")
            .withIndex("change_requests_by_year", (q: any) => q.eq("year", year))
            .order("asc")
            .paginate(args.paginationOpts);
        return {
            page: result.page,
            isDone: result.isDone,
            continueCursor: result.continueCursor,
        };
    },
});

export const nextChangeNoticeId = query({
    args: { year: v.optional(v.int64()) },
    handler: async (ctx, args) => {
        const year = args.year ?? currentYearInt();
        const prefix = await getSequencePrefix(ctx, "changeRequest");
        const { lastNumber } = await getBootstrappedLastSequence(ctx, year);
        return formatSuggestedChangeNoticeId(prefix, intToNumber(year), lastNumber + 1);
    },
});

export const changeNotices = query({
    args: { year: v.optional(v.int64()) },
    handler: async (ctx, args) => {
        const year = args.year ?? currentYearInt();
        return await ctx.db
            .query("changeNotices")
            .withIndex("change_notices_by_year", (q: any) => q.eq("year", year))
            .order("asc")
            .take(100);
    },
});

export const nextChangeNotificationId = query({
    args: { year: v.optional(v.int64()) },
    handler: async (ctx, args) => {
        const year = args.year ?? currentYearInt();
        const prefix = await getSequencePrefix(ctx, "changeNotification");
        const { lastNumber } = await getBootstrappedLastNoticeSequence(ctx, year);
        return formatSuggestedChangeNoticeId(prefix, intToNumber(year), lastNumber + 1);
    },
});

export const sequencePrefixSettings = query({
    handler: async (ctx) => {
        const [changeRequest, changeNotification] = await Promise.all([
            getSequencePrefix(ctx, "changeRequest"),
            getSequencePrefix(ctx, "changeNotification"),
        ]);
        return {
            changeRequest,
            changeNotification,
            defaults: DEFAULT_SEQUENCE_PREFIXES,
        };
    },
});

export const updateSequencePrefix = mutation({
    args: {
        sequenceType: v.union(v.literal("changeRequest"), v.literal("changeNotification")),
        prefix: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedPrefix = normalizeSequencePrefix(args.prefix);
        const row = await getSequencePrefixRow(ctx, args.sequenceType);
        const updatedAt = nowInt();
        const updatedBy = "anonymous";

        if (row) {
            await ctx.db.patch("sequencePrefixSettings", row._id, {
                prefix: normalizedPrefix,
                updatedAt,
                updatedBy,
            });
        } else {
            await ctx.db.insert("sequencePrefixSettings", {
                sequenceType: args.sequenceType,
                prefix: normalizedPrefix,
                updatedAt,
                updatedBy,
            });
        }

        return { sequenceType: args.sequenceType, prefix: normalizedPrefix };
    },
});

export const addChangeNotice = mutation({
    args: {
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const authorFields = await getCurrentAuthorFields(ctx);
        const created = await createChangeNoticeWithNextId(ctx, {
            description: args.description,
            ...authorFields,
        });
        return { id: created.id };
    },
});

export const addChangeNotification = mutation({
    args: {
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const authorFields = await getCurrentAuthorFields(ctx);
        const created = await createChangeNotificationWithNextId(ctx, {
            description: args.description,
            ...authorFields,
        });
        return { id: created.id };
    },
});

export const addChangeNoticeTarget = mutation({
    args: {
        changeNoticeId: v.id("changeRequests"),
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
        const notice = await ctx.db.get("changeRequests", args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }
        const item = await ctx.db.get("items", args.itemId);
        if (!item) {
            throw new Error("Item not found");
        }

        const existingTargets = await ctx.db
            .query("changeRequestTargets")
            .withIndex("by_change_request", (q) => q.eq("changeRequestId", args.changeNoticeId))
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

        const targetId = await ctx.db.insert("changeRequestTargets", {
            changeRequestId: args.changeNoticeId,
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

export const changeNoticeTargetsForEcn = query({
    args: { changeNoticeId: v.id("changeRequests") },
    handler: async (ctx, args) => {
        const targets = await ctx.db
            .query("changeRequestTargets")
            .withIndex("by_change_request", (q) => q.eq("changeRequestId", args.changeNoticeId))
            .collect();

        const targetsWithItems = await Promise.all(
            targets.map(async (target) => ({
                ...target,
                item: await ctx.db.get("items", target.itemId),
            })),
        );

        return targetsWithItems;
    },
});

export const changeNoticeLinksForEcn = query({
    args: { changeNoticeId: v.id("changeRequests") },
    handler: async (ctx, args) => {
        const [asParent, asChild] = await Promise.all([
            ctx.db
                .query("changeRequestLinks")
                .withIndex("by_parent", (q) => q.eq("parentChangeRequestId", args.changeNoticeId))
                .collect(),
            ctx.db
                .query("changeRequestLinks")
                .withIndex("by_child", (q) => q.eq("childChangeRequestId", args.changeNoticeId))
                .collect(),
        ]);

        return { asParent, asChild };
    },
});

export const changeNoticeRoutingMatrix = query({
    args: { changeNoticeId: v.id("changeNotices") },
    handler: async (ctx, args) => {
        const notice = await ctx.db.get(args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }

        const [rows, assignments] = await Promise.all([
            ctx.db
                .query("changeNoticeRoutingRows")
                .withIndex("by_change_notice", (q) => q.eq("changeNoticeId", args.changeNoticeId))
                .collect(),
            ctx.db
                .query("changeNoticeRoutingAssignments")
                .withIndex("by_change_notice", (q) => q.eq("changeNoticeId", args.changeNoticeId))
                .collect(),
        ]);

        const itemEntries = await Promise.all(
            rows.map(async (row) => {
                const item = await ctx.db.get(row.itemId);
                return [String(row.itemId), item] as const;
            }),
        );
        const itemById = new Map(itemEntries);

        const assignmentByRowAndGroup = new Map<
            string,
            {
                required: boolean;
                templateId: string;
                tasks: string[];
                workGroupName?: string;
                workGroupOwner?: string;
            }
        >();
        for (const assignment of assignments) {
            assignmentByRowAndGroup.set(`${String(assignment.itemId)}:${assignment.workGroupId}`, {
                required: assignment.required,
                templateId: assignment.templateId ?? "",
                tasks: assignment.tasks,
                workGroupName: assignment.workGroupName,
                workGroupOwner: assignment.workGroupOwner,
            });
        }

        const resultRows = rows
            .map((row) => {
                const item = itemById.get(String(row.itemId));
                if (!item) {
                    return null;
                }
                return {
                    id: String(row._id),
                    itemId: String(row.itemId),
                    partNumber: item.partNumber,
                    name: item.name,
                    itemType: item.itemType,
                };
            })
            .filter(
                (
                    row,
                ): row is {
                    id: string;
                    itemId: string;
                    partNumber: string;
                    name: string;
                    itemType: "product" | "raw material" | "service";
                } => row !== null,
            );

        return {
            rows: resultRows,
            assignmentByRowAndGroup: Object.fromEntries(assignmentByRowAndGroup),
        };
    },
});

export const addChangeNoticeRoutingItem = mutation({
    args: {
        changeNoticeId: v.id("changeNotices"),
        itemId: v.id("items"),
    },
    handler: async (ctx, args) => {
        const notice = await ctx.db.get(args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }
        const item = await ctx.db.get(args.itemId);
        if (!item) {
            throw new Error("Item not found");
        }

        const existing = await ctx.db
            .query("changeNoticeRoutingRows")
            .withIndex("by_change_notice_item", (q) =>
                q.eq("changeNoticeId", args.changeNoticeId).eq("itemId", args.itemId)
            )
            .unique();

        if (existing) {
            return { rowId: existing._id, deduplicated: true };
        }

        const rowId = await ctx.db.insert("changeNoticeRoutingRows", {
            changeNoticeId: args.changeNoticeId,
            itemId: args.itemId,
            addedAt: nowInt(),
        });

        return { rowId, deduplicated: false };
    },
});

export const removeChangeNoticeRoutingItem = mutation({
    args: {
        changeNoticeId: v.id("changeNotices"),
        itemId: v.id("items"),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("changeNoticeRoutingRows")
            .withIndex("by_change_notice_item", (q) =>
                q.eq("changeNoticeId", args.changeNoticeId).eq("itemId", args.itemId)
            )
            .unique();
        if (row) {
            await ctx.db.delete(row._id);
        }

        const assignments = await ctx.db
            .query("changeNoticeRoutingAssignments")
            .withIndex("by_change_notice_item", (q) =>
                q.eq("changeNoticeId", args.changeNoticeId).eq("itemId", args.itemId)
            )
            .collect();
        await Promise.all(assignments.map((assignment) => ctx.db.delete(assignment._id)));

        return { removed: !!row, assignmentsRemoved: assignments.length };
    },
});

export const setChangeNoticeRoutingAssignment = mutation({
    args: {
        changeNoticeId: v.id("changeNotices"),
        itemId: v.id("items"),
        workGroupId: v.string(),
        workGroupName: v.optional(v.string()),
        workGroupOwner: v.optional(v.string()),
        required: v.boolean(),
        templateId: v.optional(v.string()),
        tasks: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const notice = await ctx.db.get(args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }
        const item = await ctx.db.get(args.itemId);
        if (!item) {
            throw new Error("Item not found");
        }

        const sanitizedTasks = args.tasks
            .map((task) => task.trim())
            .filter((task) => task.length > 0);
        const templateId = args.templateId?.trim();

        const existing = await ctx.db
            .query("changeNoticeRoutingAssignments")
            .withIndex("by_change_notice_item_group", (q) =>
                q
                    .eq("changeNoticeId", args.changeNoticeId)
                    .eq("itemId", args.itemId)
                    .eq("workGroupId", args.workGroupId)
            )
            .unique();

        if (!args.required && !templateId && sanitizedTasks.length === 0) {
            if (existing) {
                await ctx.db.delete(existing._id);
            }
            return { saved: false, deleted: !!existing };
        }

        const row = await ctx.db
            .query("changeNoticeRoutingRows")
            .withIndex("by_change_notice_item", (q) =>
                q.eq("changeNoticeId", args.changeNoticeId).eq("itemId", args.itemId)
            )
            .unique();
        if (!row) {
            await ctx.db.insert("changeNoticeRoutingRows", {
                changeNoticeId: args.changeNoticeId,
                itemId: args.itemId,
                addedAt: nowInt(),
            });
        }

        const payload = {
            changeNoticeId: args.changeNoticeId,
            itemId: args.itemId,
            workGroupId: args.workGroupId,
            workGroupName: args.workGroupName?.trim() || undefined,
            workGroupOwner: args.workGroupOwner?.trim() || undefined,
            required: args.required,
            templateId: templateId || undefined,
            tasks: sanitizedTasks,
            updatedAt: nowInt(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return { saved: true, assignmentId: existing._id };
        }

        const assignmentId = await ctx.db.insert("changeNoticeRoutingAssignments", payload);
        return { saved: true, assignmentId };
    },
});

export const impactAnalysisSuggestionsForEcn = query({
    args: {
        changeNoticeId: v.id("changeRequests"),
        status: v.optional(
            v.union(
                v.literal("open"),
                v.literal("accepted"),
                v.literal("dismissed"),
                v.literal("superseded"),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const status = args.status ?? "open";
        return await ctx.db
            .query("requestImpactAnalysisSuggestions")
            .withIndex("by_change_request", (q) =>
                q.eq("changeRequestId", args.changeNoticeId).eq("status", status)
            )
            .collect();
    },
});

export const runImpactAnalysisForEcn = mutation({
    args: { changeNoticeId: v.id("changeRequests") },
    handler: async (ctx, args) => {
        const notice = await ctx.db.get("changeRequests", args.changeNoticeId);
        if (!notice) {
            throw new Error("Change notice not found");
        }

        const targets = await ctx.db
            .query("changeRequestTargets")
            .withIndex("by_change_request", (q) => q.eq("changeRequestId", args.changeNoticeId))
            .collect();
        const targetedItemIds = new Set(targets.map((target) => String(target.itemId)));

        const openSuggestions = await ctx.db
            .query("requestImpactAnalysisSuggestions")
            .withIndex("by_change_request", (q) =>
                q.eq("changeRequestId", args.changeNoticeId).eq("status", "open")
            )
            .collect();
        const openSuggestionKeys = new Set(
            openSuggestions.map(
                (s) => `${s.suggestionType}:${s.suggestedItemId ? String(s.suggestedItemId) : ""}`,
            ),
        );

        const queuedProductItemIds: string[] = [];
        for (const target of targets) {
            if (target.targetRole !== "direct") {
                continue;
            }
            const item = await ctx.db.get("items", target.itemId);
            if (item?.itemType === "product") {
                queuedProductItemIds.push(String(item._id));
            }
        }

        const visitedProductItemIds = new Set<string>();
        let created = 0;
        let skippedDuplicates = 0;
        const now = nowInt();

        while (queuedProductItemIds.length > 0) {
            const productItemIdString = queuedProductItemIds.shift();
            if (!productItemIdString || visitedProductItemIds.has(productItemIdString)) {
                continue;
            }
            visitedProductItemIds.add(productItemIdString);

            const productItem = await ctx.db.get("items", productItemIdString as any);
            if (!productItem || productItem.itemType !== "product") {
                continue;
            }

            const productRecord = await ctx.db
                .query("products")
                .withIndex("by_product_number", (q) => q.eq("productNumber", productItem.partNumber))
                .unique();

            if (!productRecord) {
                const key = `create_follow_up_ecn:${String(productItem._id)}`;
                if (!targetedItemIds.has(String(productItem._id)) && !openSuggestionKeys.has(key)) {
                    await ctx.db.insert("requestImpactAnalysisSuggestions", {
                        changeRequestId: args.changeNoticeId,
                        sourceItemId: productItem._id,
                        suggestionType: "create_follow_up_ecn",
                        suggestedItemId: productItem._id,
                        suggestedPartNumber: productItem.partNumber,
                        suggestedName: productItem.name,
                        reason:
                            `Nested product item ${productItem.partNumber} (${productItem.name}) ` +
                            "is referenced but has no product BOM record. Consider creating a follow-up ECN.",
                        status: "open",
                        createdAt: now,
                    });
                    openSuggestionKeys.add(key);
                    created += 1;
                } else {
                    skippedDuplicates += 1;
                }
                continue;
            }

            for (const line of productRecord.bom) {
                const childItem = await ctx.db.get("items", line.itemId);
                if (!childItem) {
                    continue;
                }
                if (childItem.itemType !== "product") {
                    continue;
                }

                queuedProductItemIds.push(String(childItem._id));

                if (targetedItemIds.has(String(childItem._id))) {
                    continue;
                }

                const childProductRecord = await ctx.db
                    .query("products")
                    .withIndex("by_product_number", (q) => q.eq("productNumber", childItem.partNumber))
                    .unique();
                const suggestionType = childProductRecord
                    ? "add_impacted_target"
                    : "create_follow_up_ecn";
                const key = `${suggestionType}:${String(childItem._id)}`;

                if (openSuggestionKeys.has(key)) {
                    skippedDuplicates += 1;
                    continue;
                }

                await ctx.db.insert("requestImpactAnalysisSuggestions", {
                    changeRequestId: args.changeNoticeId,
                    sourceItemId: productItem._id,
                    suggestionType,
                    suggestedItemId: childItem._id,
                    suggestedPartNumber: childItem.partNumber,
                    suggestedName: childItem.name,
                    reason: childProductRecord
                        ? `Nested product item ${childItem.partNumber} (${childItem.name}) is used in BOM and should be reviewed as an impacted target.`
                        : `Nested product item ${childItem.partNumber} (${childItem.name}) is used in BOM and has no product BOM record. Consider creating a follow-up ECN.`,
                    status: "open",
                    createdAt: now,
                });
                openSuggestionKeys.add(key);
                created += 1;
            }
        }

        return {
            created,
            skippedDuplicates,
            inspectedDirectTargets: targets.filter((t) => t.targetRole === "direct").length,
        };
    },
});

export const acceptSuggestionCreateFollowUpEcn = mutation({
    args: {
        suggestionId: v.id("requestImpactAnalysisSuggestions"),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const authorFields = await getCurrentAuthorFields(ctx);
        const suggestion = await ctx.db.get("requestImpactAnalysisSuggestions", args.suggestionId);
        if (!suggestion) {
            throw new Error("Suggestion not found");
        }
        if (suggestion.status !== "open") {
            throw new Error("Suggestion is not open");
        }
        if (suggestion.suggestionType !== "create_follow_up_ecn") {
            throw new Error("Suggestion is not a follow-up ECN suggestion");
        }

        const parentNotice = await ctx.db.get("changeRequests", suggestion.changeRequestId);
        if (!parentNotice) {
            throw new Error("Parent change notice not found");
        }

        const now = nowInt();
        const created = await createChangeNoticeWithNextId(ctx, {
            description:
                args.description ??
                suggestion.reason ??
                `Follow-up change notice for ${parentNotice.id}`,
            ...authorFields,
            now,
        });

        await ctx.db.insert("changeRequestLinks", {
            parentChangeRequestId: suggestion.changeRequestId,
            childChangeRequestId: created.noticeId,
            reason: "follow_up_for_subassembly",
            createdAt: now,
            createdBy: "Anonymous",
        });

        if (suggestion.suggestedItemId) {
            await ctx.db.insert("changeRequestTargets", {
                changeRequestId: created.noticeId,
                itemId: suggestion.suggestedItemId,
                targetRole: "direct",
                changeType: "modify",
                notes: "Auto-added from accepted impact analysis suggestion.",
            });
        }

        await ctx.db.patch("requestImpactAnalysisSuggestions", args.suggestionId, {
            status: "accepted",
            createdChangeRequestId: created.noticeId,
            resolvedAt: now,
            resolvedBy: "Anonymous",
        });

        return {
            changeNoticeId: created.noticeId,
            id: created.id,
        };
    },
});

export const startChangeRequest = mutation({
    args: { requestId: v.id("changeRequests") },
    handler: async (ctx, args) => {
        const request = await ctx.db.get("changeRequests", args.requestId);
        if (!request) {
            throw new Error("Change request not found");
        }
        if (request.state !== "proposed") {
            throw new Error("Only proposed change requests can be started");
        }

        await ctx.db.patch("changeRequests", args.requestId, { state: "started" });
    },
});
