import express from "express";
import { createMainRecipe, getDishList, getRecipeByName } from "../controllers/mainrecipe.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createMainRecipe);
router.get("/dish-list", authMiddleware, getDishList);
router.get("/recipe/:recipeName", authMiddleware, getRecipeByName);

export default router;
