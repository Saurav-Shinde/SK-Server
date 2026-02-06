import MainRecipe from "../models/mainrecipe.models.js";
import SubRecipe from "../models/subrecipe.models.js";

/* ================= GET MAIN RECIPES ================= */

export const getMainRecipes = async (req, res) => {
  const recipes = await MainRecipe.find(
    { brand },
    "recipeName brand"
  );

  res.json(recipes);
};

const normalizeCategory = (category) => {
  if (category === "P") return "Packaging";
  return "Food"; // default for "F", undefined, old data
};

/* ================= CALCULATE COST ================= */

export const calculateFoodCost = async (req, res) => {
  const { recipeName, wastagePercent = 0 } = req.body;

  const mainRecipe = await MainRecipe.findOne({ recipeName });
  if (!mainRecipe) {
    return res.status(404).json({ message: "Recipe not found" });
  }

  let breakdown = [];
  let foodCost = 0;
  let packagingCost = 0;

  // 🔁 expand items recursively
  for (const item of mainRecipe.items) {
    await expandItem({
      item,
      multiplier: 1,
      level: 0,
      breakdown,
      totals: { foodCost, packagingCost },
    });
  }

  // recalc totals from breakdown (safe)
  foodCost = breakdown
    .filter(b => b.category === "Food")
    .reduce((s, b) => s + b.cost, 0);

  packagingCost = breakdown
    .filter(b => b.category === "Packaging")
    .reduce((s, b) => s + b.cost, 0);

  // 12% added food cost
  const foodCostWithTax = foodCost * 1.12;

  // production variance = 5% of food cost WITH 12%
  const productionVariance = foodCostWithTax * 0.05;

  const total =
    foodCostWithTax + packagingCost + productionVariance;

  res.json({
    breakdown,
    foodCost: round(foodCostWithTax), // includes 12%
    packagingCost: round(packagingCost),
    productionVariance: round(productionVariance),
    total: round(total),
  });
};

/* ================= RECURSIVE EXPAND ================= */

async function expandItem({
  item,
  multiplier,
  level,
  breakdown,
}) {
  const isSubrecipeChild = level > 0;

  const baseCost = isSubrecipeChild
    ? 0 // ❌ DO NOT ADD COST FOR SUBRECIPE CHILDREN
    : calculateCost(item) * multiplier;

  breakdown.push({
    item: item.refId,
    type: item.type,
    category: normalizeCategory(item.category),
    qty: item.quantity,
    uom: item.uom,
    cost: round(baseCost),
    level,
  });

  // 🔽 expand ONLY for display
  if (item.type === "SUBRECIPE") {
    const sub = await SubRecipe.findOne({
      recipeName: item.refId,
    });

    if (!sub) return;

    for (const child of sub.items) {
      await expandItem({
        item: child,
        multiplier,
        level: level + 1,
        breakdown,
      });
    }
  }
}

/* ================= HELPERS ================= */
const escapeRegex = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const calculateCost = ({ quantity, netPrice, uom }) => {
  const qty = Number(quantity || 0);
  const price = Number(netPrice || 0);

  if (!qty || !price) return 0;

  if (uom === "GM") {
    return (qty / 1000) * price;
  }

  return qty * price;
};

/* ================= SUMMARY ================= */

export const getSummary = async (req, res) => {
  console.log(req.user.brand);
  const wastagePercent = Number(req.query.wastagePercent || 0);
  const brandName = req.query.brandName;

  const filter = {};

  if (brandName) {
    // substring match on brand
    filter.brand = { $regex: brandName, $options: "i" };
  }

  const recipes = await MainRecipe.find(
    { brandName },
    "recipeName brand"
  );

  const summary = [];

  for (const recipe of recipes) {
    const result = await calculateRecipe(recipe._id);

    summary.push({
      dishName: recipe.recipeName,
      brand: recipe.brand,
      foodCost: result.foodCost,
      packagingCost: result.packagingCost,
      productionVariance: result.productionVariance,
      totalCost: result.total,
    });
  }

  res.json({ summary });
};

async function calculateRecipe(recipeId) {
  const mainRecipe = await MainRecipe.findById(recipeId);
  if (!mainRecipe) return null;

  let breakdown = [];

  for (const item of mainRecipe.items) {
    await expandItem({
      item,
      multiplier: 1,
      level: 0,
      breakdown,
    });
  }

  const foodCost = breakdown
    .filter(b => b.category === "Food")
    .reduce((s, b) => s + b.cost, 0);

  const packagingCost = breakdown
    .filter(b => b.category === "Packaging")
    .reduce((s, b) => s + b.cost, 0);

  const foodCostWithTax = foodCost * 1.12;
  const productionVariance = foodCostWithTax * 0.05;

  return {
    foodCost: round(foodCostWithTax), // includes 12%
    packagingCost: round(packagingCost),
    productionVariance: round(productionVariance),
    total: round(
      foodCostWithTax + packagingCost + productionVariance
    ),
  };
}

const round = (n) => Number(n.toFixed(2));