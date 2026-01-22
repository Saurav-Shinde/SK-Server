// models/SubRecipe.js
import mongoose from "mongoose";

const subRecipeSchema = new mongoose.Schema({
  brand: { type: String, required: true },

  bomName: { type: String, required: true }, 
  // e.g. "SR: FRIED ONION"

  type: {
    type: String,
    enum: ["Ingredient", "SubRecipe"],
    required: true,
  },

  itemDescription: { type: String, required: true },

  uom: { type: String, enum: ["GM", "KG", "PC"], required: true },

  quantity: { type: Number, required: true },

  pricePerUnit: { type: Number, required: true },

  quantityPrice: { type: Number, required: true },

  yield: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model("SubRecipe", subRecipeSchema,"subrecipe");
