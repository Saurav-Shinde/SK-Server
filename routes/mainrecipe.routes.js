import express from "express";
import { createMainRecipe, getDishList } from "../controllers/mainrecipe.controller.js";

const router = express.Router();

router.post("/", createMainRecipe);
router.get("/dish-list", getDishList);

export default router;
