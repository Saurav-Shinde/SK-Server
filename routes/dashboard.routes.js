import express from "express";

const router = express.Router();

/* TEST ROUTE */
router.get("/stats", (req, res) => {
  res.json({
    totalOrders: 120,
    activeOrders: 5,
    revenue: 45000,
    customers: 32,
  });
});

router.get("/low-stock", (req, res) => {
  res.json([
    { name: "Chicken", quantity: 4, unit: "kg" },
    { name: "Oil", quantity: 1, unit: "L" },
  ]);
});

export default router;
