import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const bomLineValidator = v.object({
  partNumber: v.string(),
  quantity: v.number(),
});

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").withIndex("by_product_number").order("asc").take(200);
  },
});

export const addProduct = mutation({
  args: {
    productNumber: v.string(),
    name: v.string(),
    bom: v.array(bomLineValidator),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("products")
      .withIndex("by_product_number", (q) => q.eq("productNumber", args.productNumber))
      .unique();

    if (existing) {
      throw new Error(`Product already exists: ${args.productNumber}`);
    }

    await ctx.db.insert("products", {
      productNumber: args.productNumber,
      name: args.name,
      bom: args.bom,
    });
  },
});
