import mongoose from "mongoose";

const indentSchema = new mongoose.Schema(
  {
    // Brand name for the indent request (order/request brand context)
    requestBrandName: { type: String, default: "", trim: true, index: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    recipeKind: { type: String, enum: ["main", "sub", "trial", "training"], required: true },
    recipeName: { type: String, default: "" },
    branchCode: { type: String, required: true, trim: true, index: true },

    skuCode: { type: String, default: "" },
    itemName: { type: String, required: true, trim: true, index: true },
    // Ingredient brand entered by Ingredient Admin during verification
    ingredientBrand: { type: String, default: "", trim: true },
    categoryName: { type: String, default: "" },
    uom: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    // Cost is captured during Ingredient Admin verification step
    cost: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["INDENT_PENDING", "INDENT_VERIFIED", "ISSUED"],
      default: "INDENT_PENDING",
      index: true,
    },
    verifiedAt: { type: Date, default: null },
    issuedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("IngredientIndent", indentSchema, "ingredient_indents");

