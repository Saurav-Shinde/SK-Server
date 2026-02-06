import MainRecipe from "../models/mainrecipe.models.js";

export const getDishList = async (req, res) => {
  try {
    const recipes = await MainRecipe.find(
      {},
      { recipeName: 1, _id: 0 }
    )
      .sort({ recipeName: 1 })
      .lean();

    res.json({
      dishes: recipes.map(r => r.recipeName),
    });
  } catch (err) {
    console.error("GET DISH LIST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch dishes" });
  }
};

export const createMainRecipe = async (req, res) => {
  try {
    const { brand, recipeName, items } = req.body;

    if (!brand || !recipeName || !Array.isArray(items)) {
      return res.status(400).json({
        message: "Invalid main recipe payload",
      });
    }

    const recipe = await MainRecipe.create({
      brand,
      recipeName,
      items,
    });

    console.log("MAIN RECIPE SAVED:", recipe._id);

    res.status(201).json({
      message: "Main recipe saved successfully",
      data: recipe,
    });

  } catch (error) {
    console.error("DB SAVE ERROR:", error);
    res.status(500).json({
      message: "Failed to save main recipe",
      error: error.message,
    });
  }
};
