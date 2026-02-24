"use node";

import Papa from "papaparse";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const csvRowSchema = z.object({
  itemNumber: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  revision: z.string().trim().min(1),
  lifecycleState: z.enum(["draft", "released", "obsolete"]).default("draft"),
  tags: z.string().optional(),
});

export const importItemsCsv: any = action({
  args: {
    organizationId: v.id("organizations"),
    fileName: v.string(),
    csvText: v.string(),
  },
  handler: async (ctx, args) => {
    const parsed = Papa.parse(args.csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    }) as { data: Array<Record<string, string>>; errors: Array<{ message: string }> };

    if (parsed.errors.length > 0) {
      throw new ConvexError({
        code: "CSV_PARSE_ERROR",
        message: `CSV parse failed: ${parsed.errors[0]?.message ?? "unknown error"}`,
      });
    }

    const rows: Array<{
      rowNumber: number;
      itemNumber: string;
      name: string;
      description: string;
      revision: string;
      lifecycleState: "draft" | "released" | "obsolete";
      tags: string[];
    }> = [];
    const errors: Array<{ rowNumber: number; itemNumber?: string; message: string }> = [];

    parsed.data.forEach((rawRow: Record<string, string>, index: number) => {
      const rowNumber = index + 2;
      const result = csvRowSchema.safeParse({
        itemNumber: rawRow.itemNumber ?? rawRow["item_number"],
        name: rawRow.name,
        description: rawRow.description ?? "",
        revision: rawRow.revision,
        lifecycleState: (rawRow.lifecycleState ?? rawRow["lifecycle_state"] ?? "draft").toLowerCase(),
        tags: rawRow.tags,
      });

      if (!result.success) {
        errors.push({
          rowNumber,
          itemNumber: rawRow.itemNumber,
          message: result.error.issues.map((issue) => issue.message).join("; "),
        });
        return;
      }

      const value = result.data;
      rows.push({
        rowNumber,
        itemNumber: value.itemNumber,
        name: value.name,
        description: value.description,
        revision: value.revision,
        lifecycleState: value.lifecycleState,
        tags: (value.tags ?? "")
          .split(/[;,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
    });

    return await ctx.runMutation(api.items.commitCsvImport, {
      organizationId: args.organizationId,
      fileName: args.fileName,
      rows,
      errors,
    });
  },
});
