// routes/costing.js
import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getDishCost } from "../controllers/costing.controller.js";

const router = express.Router();

router.get("/:dish", authMiddleware, getDishCost);

export default router;
