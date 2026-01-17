import mongoose from "mongoose";

const SubRecipeSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true },

    // Excel BOM NAME
    name: { type: String, required: true },

    // Used for safe lookups
    normalizedName: { type: String, index: true },

    // Excel Yield column
    yieldQty: { type: Number, required: true },
    batchCost: Number,      // Excel Total Cost (Batch)
    costPerUnit: Number,    // Excel Cost Per Unit
    // Ingredients + nested sub-recipes
    items: [
      {
        type: { type: String, enum: ["Ingredient", "SubRecipe"], required: true },
        name: { type: String, required: true },
        uom: { type: String, default: "GM" },
        qty: { type: Number, required: true }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("SubRecipe", SubRecipeSchema, "subrecipes_raw");
