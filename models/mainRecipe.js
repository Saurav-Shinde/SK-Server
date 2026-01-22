// models/MainRecipe.js
import mongoose from "mongoose";

const mainRecipeSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      default: "DEFAULT",
    },

    bomName: {
      type: String,
      index: true,
    },

    category: {
      type: String,
      enum: ["F", "P"],
      default: "F", // Food by default
    },

    type: {
      type: String,
      enum: ["Ingredient", "SubRecipe"],
    },

    itemDescription: {
      type: String,
    },

    uom: {
      type: String,
      enum: ["GM", "KG", "PC", "NOS", "PCS", "Pcs"],
      default: "PC",
    },

    quantity: {
      type: Number,
      default: 0,
    },

    // OPTIONAL: price per unit (future use)
    pricePerUnit: {
      type: Number,
      default: null,
    },

    // 🔥 AUTHORITATIVE COST FIELD
    quantityPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: false, // 🔥 VERY IMPORTANT (allows legacy fields)
  }
);

export default mongoose.model(
  "MainRecipe",
  mainRecipeSchema,
  "mainrecipe"
);
