import express from "express";
import {
  createSubRecipe,
  getSubRecipeDishList,
  getSubRecipes,
  getSubRecipeCost,
} from "../controllers/subrecipe.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createSubRecipe);
router.get("/", getSubRecipes);
router.get("/dish-list", authMiddleware, getSubRecipeDishList);
// routes/subrecipe.routes.js
router.get("/:recipeName/cost", getSubRecipeCost);

export default router;
