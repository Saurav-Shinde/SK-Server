import express from "express";
import { ristaRequest } from "../ristaClient.js";

const router = express.Router();

// 📊 Dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const ordersRes = await ristaRequest("GET", "/orders");
    const orders = ordersRes.data?.orders || [];

    res.json({
      totalOrders: orders.length,
      activeOrders: orders.filter(o => o.status === "OPEN").length,
      revenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      customers: new Set(orders.map(o => o.customer_id)).size,
    });
  } catch (err) {
    res.status(500).json({ message: "Stats fetch failed", error: err.message });
  }
});

// 📦 Low stock items
router.get("/low-stock", async (req, res) => {
  try {
    const inventoryRes = await ristaRequest("GET", "/inventory/items");

    const lowStock = inventoryRes.data.items.filter(
      item => item.quantity <= item.reorder_level
    );

    res.json(
      lowStock.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        status: i.quantity === 0 ? "critical" : "low",
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Inventory fetch failed" });
  }
});

export default router;
