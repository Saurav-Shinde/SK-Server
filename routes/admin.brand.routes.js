import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import Brand from "../models/brand.js";

const router = express.Router();

/**
 * ----------------------------------------------------
 * POST /api/brand/settings
 * Save dashboard analytics filters for a brand
 * (branchCode + period)
 * ----------------------------------------------------
 *
 * This route is:
 * - Used by Brand Dashboard (NOT admin)
 * - Requires authenticated brand user
 * - Persists selected branch + period in Brand document
 */


export default router;
