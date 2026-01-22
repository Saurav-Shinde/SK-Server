import { calculateMainRecipeCost } from "../utils/costing.services.js";
import MainRecipe from "../models/mainRecipe.js";

export const getDishList = async (req, res) => {
  try {
    const dishes = await MainRecipe.distinct("bomName");

    // Sort alphabetically for dropdown UX
    dishes.sort((a, b) => a.localeCompare(b));

    res.json({ dishes });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dishes" });
  }
};

const getFoodCost = async (req, res) => {
  try {
    const wastagePercent = Number(req.query.wastagePercent ?? 5);
    const result = await calculateMainRecipeCost(req.params.dishName, wastagePercent);
    res.json(result);
    console.log("Dish received:", req.params.dishName);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// controllers/costing.controller.js
export const getAllDishesSummary = async (req, res) => {
  try {
    const wastagePercent = Number(req.query.wastagePercent ?? 5);

    const dishes = await MainRecipe.distinct("bomName");

    const summary = [];

    for (const dish of dishes) {
      const result = await calculateMainRecipeCost(dish, wastagePercent);

      summary.push({
        dishName: dish,
        foodCost: result.totalFoodCost,
        packagingCost: result.totalPackagingCost,
        wastageCost: result.wastageCost,
        totalCost: result.totalCost,
      });
    }

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export default getFoodCost;
