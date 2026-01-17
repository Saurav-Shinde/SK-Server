import mongoose from "mongoose";

const MainRecipeSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true },

    name: { type: String, required: true },
    normalizedName: { type: String, index: true },

    // Excel: number of portions this BOM makes
    servings: { type: Number, required: true },

    // ✅ Excel columns
    sellingPrice: { type: Number, required: true },      // "Current Price"
    packagingCharge: { type: Number, default: 0 },       // "Packaging Cost Pushed to Customer"
    packagingPushed: { type: Number, default: 0 },
    items: [
      {
        category: { type: String, enum: ["Food", "Packaging"], required: true },
        type: { type: String, enum: ["Ingredient", "SubRecipe"], required: true },
        name: { type: String, required: true },
        uom: { type: String },
        qty: { type: Number, required: true }
      }
    ]
  },
  { timestamps: true }
);


export default mongoose.models.MainRecipe ||
  mongoose.model("MainRecipe", MainRecipeSchema, "mainrecipes_raw");
