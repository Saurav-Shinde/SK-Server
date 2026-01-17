import ItemMaster from "../models/itemMaster.js";
import SubRecipe from "../models/subRecipe.js";
import MainRecipe from "../models/mainRecipe.js";

const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const getDishCost = async (req, res) => {
  try {
    const dish = req.params.dish;
    const brandName = "Al Mashawi";

    const recipe = await MainRecipe.findOne({
      brandName,
      normalizedName: normalize(dish)
    });

    if (!recipe) {
      return res.status(404).json({ message: "Dish not found" });
    }

    let foodCost = 0;
    let packagingCost = recipe.packagingCharge || 0;

    for (const row of recipe.items) {

      // ---------------- SUB RECIPES (Excel style) ----------------
      if (row.type === "SubRecipe") {
        const sr = await SubRecipe.findOne({
          brandName,
          normalizedName: normalize(row.name)
        });

        if (!sr) throw new Error(`SubRecipe not found: ${row.name}`);

        // Excel: ₹ per KG × grams / 1000
        const cost = (sr.costPerUnit * row.qty) / 1000;
        foodCost += cost;
      }

      // ---------------- RAW INGREDIENTS ----------------
      if (row.type === "Ingredient") {
        const item = await ItemMaster.findOne({ "Item Name": row.name });
        if (!item) throw new Error(`Item not found: ${row.name}`);

        const price =
          item["Unit Price(for 1000 GM/1 PC)"] ??
          item["IF PRICE NOT FOUND IN SEP-DEC USED OLD ITEM MASTER PRICE"];

        const yieldPct = parseFloat(item["Yield"] || "100");

        let cost = (price / 1000) * row.qty;
        cost = cost / (yieldPct / 100);

        foodCost += cost;
      }
    }

    // Excel columns
    const foodCostWithWastage = foodCost * 1.05;
    const totalCost = foodCostWithWastage + packagingCost;

    const sellingPrice = recipe.sellingPrice || 0;

    const packagingPushed = recipe.packagingPushed || 0;

    const servings = recipe.servings || 1;

    const foodPerPlate = foodCost / servings;
    const foodWithWastePerPlate = foodCostWithWastage / servings;
    const packagingPerPlate = packagingCost;   // packaging is per plate
    const totalPerPlate = foodWithWastePerPlate + packagingPerPlate;

    const foodCostPercent = sellingPrice
    ? (totalPerPlate / sellingPrice) * 100
    : 0;

    const finalFoodCost = totalPerPlate - packagingPushed;
    const finalFoodCostPercent = sellingPrice
    ? (finalFoodCost / sellingPrice) * 100
    : 0;

    res.json({
    dish: recipe.name,

    foodCost: Number(foodPerPlate.toFixed(2)),
    foodCostWithWastage: Number(foodWithWastePerPlate.toFixed(2)),
    packagingCost: Number(packagingPerPlate.toFixed(2)),
    totalCost: Number(totalPerPlate.toFixed(2)),

    sellingPrice,
    foodCostPercent: Number(foodCostPercent.toFixed(2)),
    packagingPushed: Number(packagingPushed.toFixed(2)),

    finalFoodCostPercent: Number(finalFoodCostPercent.toFixed(2))
    });


  } catch (err) {
    console.error("Costing error:", err);
    res.status(500).json({ message: err.message });
  }
};

