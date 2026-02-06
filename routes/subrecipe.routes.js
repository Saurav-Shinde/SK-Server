import express from "express";
import { createSubRecipe, getSubRecipes, getSubRecipeCost } from "../controllers/subrecipe.controller.js";

const router = express.Router();

router.post("/", createSubRecipe);
router.get("/", getSubRecipes);
// routes/subrecipe.routes.js
router.get("/:recipeName/cost", getSubRecipeCost);

export default router;
