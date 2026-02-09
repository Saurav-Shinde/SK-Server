import MainRecipe from "../models/mainrecipe.models.js";
import SubRecipe from "../models/subrecipe.models.js";

const normalizeCategory = (category) => {
  if (category === "P") return "Packaging";
  return "Food";
};

const round = (n) => Number(n.toFixed(2));

const calculateCost = ({ quantity, netPrice, uom }) => {
  const qty = Number(quantity || 0);
  const price = Number(netPrice || 0);
  if (!qty || !price) return 0;
  if (uom === "GM") return (qty / 1000) * price;
  return qty * price;
};

async function expandItem({ item, multiplier, level, breakdown, brand }) {
  const isSubrecipeChild = level > 0;
  const baseCost = isSubrecipeChild
    ? 0
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

  if (item.type === "SUBRECIPE") {
    const subQuery = brand
      ? { recipeName: item.refId, brand }
      : { recipeName: item.refId };
    const sub = await SubRecipe.findOne(subQuery);
    if (!sub) return;
    for (const child of sub.items) {
      await expandItem({
        item: child,
        multiplier,
        level: level + 1,
        breakdown,
        brand: brand || sub.brand,
      });
    }
  }
}

export const getAllRecipes = async (req, res) => {
  try {
    const recipes = await MainRecipe.find({})
      .select("recipeName brand")
      .sort({ brand: 1, recipeName: 1 })
      .lean();

    res.json(recipes);
  } catch (err) {
    console.error("Admin get all recipes error:", err);
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
};

export const getRecipeBreakdown = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const mainRecipe = await MainRecipe.findById(recipeId);
    
    if (!mainRecipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    const breakdown = [];
    for (const item of mainRecipe.items) {
      await expandItem({
        item,
        multiplier: 1,
        level: 0,
        breakdown,
        brand: mainRecipe.brand,
      });
    }

    res.json({
      recipeName: mainRecipe.recipeName,
      brand: mainRecipe.brand,
      breakdown,
    });
  } catch (err) {
    console.error("Admin get recipe breakdown error:", err);
    res.status(500).json({ message: "Failed to fetch breakdown" });
  }
};
