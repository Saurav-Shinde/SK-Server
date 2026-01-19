import express from "express";
import User from "../models/user.js";
import BrandServiceChecklist from "../models/brandServiceChecklist.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = express.Router();

/* ================= BRANDS ================= */
router.get(
  "/brands",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const brands = await User.find({})
      .select("brandName email wallet")
      .sort({ createdAt: -1 });

    res.json(brands);
  }
);

/* ================= GET SERVICES ================= */
router.get(
  "/services/:brandId",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { brandId } = req.params;

    let checklist = await BrandServiceChecklist.findOne({ brandId });

    // If first time → initialize checklist
    if (!checklist) {
      checklist = await BrandServiceChecklist.create({
        brandId,
        services: [
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
          "Branding - naming, positioning"
        ].map(name => ({ name }))
      });
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

export default router;
