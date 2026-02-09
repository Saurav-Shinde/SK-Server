import express from "express";
import User from "../models/user.js";
import BrandServiceChecklist from "../models/brandServiceChecklist.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import Order from "../models/order.js";
import { getAllRecipes, getRecipeBreakdown } from "../controllers/admin.recipes.controller.js";

const router = express.Router();

/* ================= BRANDS ================= */
router.get(
  "/brands",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      // 1️⃣ Get ALL brands safely
      const brands = await User.find({
        brandName: { $exists: true }
      })
        .select("brandName email wallet role")
        .sort({ createdAt: -1 })
        .lean();

      // 2️⃣ Get unseen orders
      const unseenOrders = await Order.find({
        isSeenByAdmin: false
      }).select("brand");

      // 3️⃣ Build lookup set
      const brandIdsWithOrders = new Set(
        unseenOrders.map(o => o.brand.toString())
      );

      // 4️⃣ Attach hasNewOrder flag
      const result = brands.map(brand => ({
        ...brand,
        hasNewOrder: brandIdsWithOrders.has(
          brand._id.toString()
        )
      }));

      res.json(result);
    } catch (err) {
      console.error("Failed to load brands", err);
      res.status(500).json({ message: "Failed to load brands" });
    }
  }
);


/* ================= GET SERVICES ================= */
router.get(
  "/services/:brandId",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { brandId } = req.params;

    const MASTER_SERVICES = [
      "Vendor sourcing & negotiation",
      "In-store branding (circle banner)",
      "Kitchen operations setup & workflow planning",
      "Waste & yield management system",
      "Menu engineering",
      "SOP creation",
      "Food tasting and trials",
      "Recipe development",
      "Pricing strategy and discounting",
      "Inventory - Process and storage",
      "Market research and competitor study",
      "Shelf life testing & documentation",
      "Food cost ratio - preparation",
      "Order flow integration - KDS, POS",
      "Branding - naming, positioning",
    ];

    let checklist = await BrandServiceChecklist.findOne({ brandId });

    // First time → create
    if (!checklist) {
      checklist = await BrandServiceChecklist.create({
        brandId,
        services: MASTER_SERVICES.map(name => ({ name }))
      });
    } else {
      // 🔥 ADD MISSING SERVICES
      const existingNames = checklist.services.map(s => s.name);

      const missing = MASTER_SERVICES
        .filter(name => !existingNames.includes(name))
        .map(name => ({ name }));

      if (missing.length) {
        checklist.services.push(...missing);
        await checklist.save();
      }
    }

    res.json(checklist);
  }
);


/* ================= UPDATE SERVICE ================= */
router.patch(
  "/services/:brandId",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { brandId } = req.params;
    const { serviceName, completed } = req.body;

    const checklist = await BrandServiceChecklist.findOne({ brandId });
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const service = checklist.services.find(s => s.name === serviceName);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.completed = completed;
    service.completedAt = completed ? new Date() : null;

    await checklist.save();
    res.json({ success: true });
  }
);




/* ================= GET ORDERS FOR BRAND ================= */
router.get(
  "/orders/:brandId",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { brandId } = req.params;

      const orders = await Order.find({ brand: brandId })
        .sort({ createdAt: -1 })
        .lean();

      // 👇 MARK AS SEEN
      await Order.updateMany(
        { brand: brandId, isSeenByAdmin: false },
        { $set: { isSeenByAdmin: true } }
      );

      res.json(orders);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  }
);


/* ================= UPDATE ORDER STATUS ================= */
router.patch(
  "/orders/:orderId",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.status = status;
      
      // Set completedAt timestamp when marking as COMPLETED
      if (status === "COMPLETED" && !order.completedAt) {
        order.completedAt = new Date();
      }
      
      await order.save();

      res.json({ success: true, order });
    } catch (err) {
      console.error("Failed to update order:", err);
      res.status(500).json({ message: "Failed to update order" });
    }
  }
);


/* ================= ADMIN: ALL RECIPES ================= */
router.get(
  "/recipes",
  authMiddleware,
  requireAdmin,
  getAllRecipes
);

router.get(
  "/recipes/:recipeId/breakdown",
  authMiddleware,
  requireAdmin,
  getRecipeBreakdown
);

export default router;
