import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function requireString(value: string | undefined, fallback: string) {
  return value && value.trim() ? value.trim() : fallback;
}

async function upsertItemByPartNumber(
  ctx: { db: any },
  args: {
    partNumber: string;
    drawingNumbers?: string[];
    revision?: string;
    name?: string;
    description?: string;
    itemType: "product" | "raw material" | "service";
  },
) {
  const existing = await ctx.db
    .query("items")
    .withIndex("by_part_number", (q: any) => q.eq("partNumber", args.partNumber))
    .unique();

  const drawingNumbers = (args.drawingNumbers ?? []).filter(Boolean);
  const revision = requireString(args.revision, "");
  const name = requireString(args.name, args.partNumber);
  const description = requireString(args.description, "");

  if (existing) {
    await ctx.db.patch("items", existing._id, {
      drawingNumbers: drawingNumbers.length > 0 ? drawingNumbers : existing.drawingNumbers,
      revision: revision || existing.revision,
      name: name || existing.name,
      description: description || existing.description,
      itemType: args.itemType,
    });
    return existing._id;
  }

  return await ctx.db.insert("items", {
    partNumber: args.partNumber,
    drawingNumbers,
    revision,
    name,
    description,
    itemType: args.itemType,
  });
}

export const listItems = query({
  handler: async (ctx) => {
    return await ctx.db.query("items").withIndex("by_part_number").order("asc").take(500);
  },
});

export const listProducts = query({
  handler: async (ctx) => {
    return await ctx.db.query("products").withIndex("by_product_number").order("asc").take(200);
  },
});

export const getProductWithBom = query({
  args: { productNumber: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_product_number", (q) => q.eq("productNumber", args.productNumber))
      .unique();
    if (!product) {
      return null;
    }

    const bom = await Promise.all(
      product.bom.map(async (line) => ({
        ...line,
        item: await ctx.db.get("items", line.itemId),
      })),
    );

    return { ...product, bom };
  },
});

export const addProduct = mutation({
  args: {
    productNumber: v.string(),
    drawingNumber: v.string(),
    revision: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    bom: v.array(
      v.object({
        itemId: v.id("items"),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_product_number", (q) => q.eq("productNumber", args.productNumber))
      .unique();

    if (existing) {
      throw new Error(`Product already exists: ${args.productNumber}`);
    }

    await upsertItemByPartNumber(ctx, {
      partNumber: args.productNumber,
      drawingNumbers: [args.drawingNumber],
      revision: args.revision,
      name: args.name,
      description: args.description,
      itemType: "product",
    });

    await ctx.db.insert("products", {
      productNumber: args.productNumber,
      drawingNumber: args.drawingNumber,
      revision: args.revision,
      name: args.name,
      bom: args.bom,
    });
  },
});

export const importProductBomFromPdmPlaceholder = mutation({
  args: {
    sourceSystem: v.union(
      v.literal("autodesk_vault_professional"),
      v.literal("other"),
    ),
    externalProductId: v.optional(v.string()),
    product: v.object({
      productNumber: v.string(),
      drawingNumber: v.string(),
      revision: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
    }),
    bomLines: v.array(
      v.object({
        partNumber: v.string(),
        drawingNumbers: v.optional(v.array(v.string())),
        revision: v.optional(v.string()),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        itemType: v.union(
          v.literal("product"),
          v.literal("raw material"),
          v.literal("service"),
        ),
        quantity: v.number(),
      }),
    ),
    mode: v.optional(v.union(v.literal("preview"), v.literal("upsert"))),
  },
  handler: async (ctx, args) => {
    const mode = args.mode ?? "preview";

    const normalizedBom = [];
    for (const line of args.bomLines) {
      normalizedBom.push({
        partNumber: line.partNumber.trim(),
        drawingNumbers: line.drawingNumbers ?? [],
        revision: line.revision ?? "",
        name: line.name ?? line.partNumber,
        description: line.description ?? "",
        itemType: line.itemType,
        quantity: line.quantity,
      });
    }

    if (mode === "preview") {
      return {
        mode,
        sourceSystem: args.sourceSystem,
        externalProductId: args.externalProductId ?? null,
        summary: {
          productNumber: args.product.productNumber,
          bomLineCount: normalizedBom.length,
          nestedProductCandidates: normalizedBom.filter((l) => l.itemType === "product").length,
        },
        notes: [
          "Placeholder import endpoint. Use mode='upsert' to write items/products.",
          "Designed for PDM push payloads (e.g. Autodesk Vault Professional integration middleware).",
        ],
      };
    }

    const rootItemId = await upsertItemByPartNumber(ctx, {
      partNumber: args.product.productNumber,
      drawingNumbers: [args.product.drawingNumber],
      revision: args.product.revision,
      name: args.product.name,
      description: args.product.description,
      itemType: "product",
    });

    const bom = [];
    for (const line of normalizedBom) {
      const itemId = await upsertItemByPartNumber(ctx, {
        partNumber: line.partNumber,
        drawingNumbers: line.drawingNumbers,
        revision: line.revision,
        name: line.name,
        description: line.description,
        itemType: line.itemType,
      });
      bom.push({ itemId, quantity: line.quantity });
    }

    const existingProduct = await ctx.db
      .query("products")
      .withIndex("by_product_number", (q) => q.eq("productNumber", args.product.productNumber))
      .unique();

    if (existingProduct) {
      await ctx.db.patch("products", existingProduct._id, {
        drawingNumber: args.product.drawingNumber,
        revision: args.product.revision,
        name: args.product.name,
        bom,
      });
      return {
        mode,
        operation: "updated",
        productId: existingProduct._id,
        rootItemId,
        bomLineCount: bom.length,
      };
    }

    const productId = await ctx.db.insert("products", {
      productNumber: args.product.productNumber,
      drawingNumber: args.product.drawingNumber,
      revision: args.product.revision,
      name: args.product.name,
      bom,
    });

    return {
      mode,
      operation: "created",
      productId,
      rootItemId,
      bomLineCount: bom.length,
    };
  },
});
