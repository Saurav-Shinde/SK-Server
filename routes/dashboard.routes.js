import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import Brand from "../models/brand.js";
import { ristaClient } from "../ristaClient.js";

const router = express.Router();

// --------------------------------------
// Helper: compute KPT (Kitchen Prep Time)
// --------------------------------------
const computeKPTMinutes = (sales) => {
  if (!Array.isArray(sales) || sales.length === 0) return 0;

  const orderKpts = sales
    .map((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];

      const kotTimes = items
        .map((i) => i.kotTimestamp)
        .filter(Boolean)
        .map((t) => new Date(t).getTime());

      const readyTimes = items
        .map((i) => i.kdsReady)
        .filter(Boolean)
        .map((t) => new Date(t).getTime());

      if (!kotTimes.length || !readyTimes.length) return null;

      const diffMs = Math.max(...readyTimes) - Math.min(...kotTimes);
      if (diffMs <= 0) return null;

      return diffMs / 60000; // minutes
    })
    .filter(Boolean);

  if (!orderKpts.length) return 0;

  const avg = orderKpts.reduce((a, b) => a + b, 0) / orderKpts.length;
  return Number(avg.toFixed(1));
};

// -----------------------------
// DASHBOARD STATS
// -----------------------------
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    console.log("[DASHBOARD] stats route hit");

    const brand = req.brand; // ✅ attached by authMiddleware

    if (!brand) {
      return res.status(401).json({
        message: "Brand context missing",
      });
    }

    const branch = brand.ristaBranchCode;
    const period =
      brand.analyticsPeriod ||
      req.query.period ||
      new Date().toISOString().slice(0, 10);

    console.log("[DASHBOARD] using filters:", { branch, period });

    if (!branch || !period) {
      return res.json({
        brandName: brand.brandName,
        status: brand.status,
        operational: false,
        statsAvailable: false,
        message: "Please select branch and date",
      });
    }

    // ---------------------------
    // Analytics summary
    // ---------------------------
    let revenue = 0;
    let totalOrders = 0;

    try {
      const summary = await ristaClient.getAnalyticsSummary({
        branch,
        period,
      });

      console.log("[RISTA] analytics summary:", summary);

      revenue = Number(summary.revenue) || 0;
      totalOrders = Number(summary.noOfSales) || 0;
    } catch (err) {
      console.error(
        "[RISTA] analytics error:",
        err?.response?.data || err.message
      );
    }

    const averageOrderValue =
      totalOrders > 0 ? Number((revenue / totalOrders).toFixed(2)) : 0;

    // ---------------------------
    // Sales page → KPT
    // ---------------------------
    let avgKPT = 0;
    try {
      const sales = await ristaClient.getSalesPage({
        branch,
        period,
      });

      console.log("[RISTA] sales fetched:", sales.length);

      avgKPT = computeKPTMinutes(sales);
    } catch (err) {
      console.error(
        "[RISTA] sales page error:",
        err?.response?.data || err.message
      );
    }

    console.log("[DASHBOARD] final payload", {
      revenue,
      totalOrders,
      avgKPT,
    });

    return res.json({
      brandName: brand.brandName,
      status: brand.status,
      eligibilityScore: brand.eligibilityScore,
      operational: true,
      statsAvailable: true,
      revenue,
      totalOrders,
      averageOrderValue,
      avgKPT,
    });
  } catch (error) {
    console.error("[DASHBOARD] fatal error:", error);
    return res.status(500).json({
      message: "Failed to load dashboard stats",
    });
  }
});

// -----------------------------
// LOW STOCK
// -----------------------------
router.get("/low-stock", authMiddleware, async (req, res) => {
  try {
    const brand = req.brand;

    if (!brand || !brand.ristaBranchCode) {
      return res.json([]);
    }

    const inventory = await ristaClient.getInventory(
      brand.ristaBranchCode
    );

    const lowStockItems = inventory.filter(
      (item) => Number(item.quantity) < 10
    );

    return res.json(
      lowStockItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }))
    );
  } catch (error) {
    console.error("[LOW STOCK] error:", error);
    return res.status(500).json({
      message: "Failed to load stock data",
    });
  }
});

export default router;
