import express from "express";
import { getInventoryItems } from "../controllers/inventory.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireAdmin.js";

const router = express.Router();

// GET /api/inventory/items
router.get("/items", authMiddleware, requireRole("INGREDIENT_MANAGER"), getInventoryItems);

export default router;
