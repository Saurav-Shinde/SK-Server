import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import Brand from "../models/brand.js";

const router = express.Router();

/**
 * POST /api/brand/settings
 * Save dashboard analytics filters (branchCode + period)
 */
router.post("/settings", authMiddleware, async (req, res) => {
  try {
    const { branchCode, period } = req.body || {};

    if (!branchCode || !period) {
      return res.status(400).json({
        message: "branchCode and period are required",
      });
    }

    const brandId = req.brand?._id;
    if (!brandId) {
      return res.status(401).json({
        message: "Brand not found in request context",
      });
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      brandId,
      {
        ristaBranchCode: branchCode.trim(),
        analyticsPeriod: period.trim(),
      },
      { new: true }
    );

    return res.json({
      success: true,
      branchCode: updatedBrand.ristaBranchCode,
      period: updatedBrand.analyticsPeriod,
    });
  } catch (error) {
    console.error("[BRAND SETTINGS]", error);
    return res.status(500).json({
      message: "Failed to save brand settings",
    });
  }
});

export default router;
