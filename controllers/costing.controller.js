import { calculateMainRecipeCost } from "../utils/costing.services.js";

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

export default getFoodCost;
