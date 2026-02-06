import express from "express";
import { getInventoryItems } from "../controllers/inventory.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// GET /api/inventory/items
router.get("/items",authMiddleware, getInventoryItems);

export default router;
