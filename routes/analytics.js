import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import Brand from '../models/brand.js'
import { ristaClient } from '../ristaClient.js'

const router = express.Router()

const normalize = (s = '') =>
  s.toString()
    .toLowerCase()
    .trim()
    .replace(/shawarma/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '')

router.get('/sales/summary', authMiddleware, async (req, res) => {
  try {
    const { day, branches: queryBranches } = req.query || {};

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({
        message: "day is required in YYYY-MM-DD format"
      });
    }

    const brandName = req.user?.brandName;
    if (!brandName) {
      return res.status(401).json({ message: "brandName missing in token" });
    }

    const norm = s => (s || "")
      .toLowerCase()
      .replace(/shawarma/g, "")
      .replace(/[^a-z0-9]/g, "");

    const brandKey = norm(brandName);

    // -------- Branch resolving ----------
    let branches = [];

    if (queryBranches) {
      branches = Array.isArray(queryBranches)
        ? queryBranches
        : [queryBranches];
    } else {
      const brandDoc = await Brand.findOne({ brandName });

      if (!brandDoc) {
        return res.json({ noData: true, reason: "brand_not_found" });
      }

      branches =
        brandDoc.ristaBranchCodes?.length
          ? brandDoc.ristaBranchCodes
          : [brandDoc.ristaBranchCode];
    }

    branches = [...new Set(branches.filter(Boolean))];

    // -------- Fetch all sales pages ----------
    const allSalesPages = await Promise.all(
      branches.map(branch =>
        ristaClient.getSalesPage({ branch, day, status: "Closed" })
      )
    );

    const allSales = allSalesPages.flat();

    if (!allSales.length) {
      return res.json({ noData: true, reason: "no_sales" });
    }

    // -------- Brand item filter ----------
    let brandItems = [];
    let brandOrderSet = new Set();

    let totalRevenue = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const sale of allSales) {
      const { invoiceNumber, billRoundedAmount, netAmount, taxAmount, totalDiscountAmount } =
        sale;

      // filter items of this brand
      const matchedItems = (sale.items || []).filter(it =>
        norm(it.brandName || it.accountName || "").includes(brandKey)
      );

      if (!matchedItems.length) continue;

      brandOrderSet.add(invoiceNumber);

      for (const it of matchedItems) {
        brandItems.push(it);
      }

      totalRevenue += Number(billRoundedAmount || 0);
      totalNet += Number(netAmount || 0);
      totalTax += Number(taxAmount || 0);
      totalDiscount += Number(totalDiscountAmount || 0);
    }

    if (!brandItems.length) {
      return res.json({
        noData: true,
        reason: "brand_items_not_found",
      });
    }

    // -------- KPI Computations ----------
    const totalOrders = brandOrderSet.size;

    const totalItemQty = brandItems.reduce(
      (s, i) => s + Number(i.quantity || 0),
      0
    );

    const totalItemNet = brandItems.reduce(
      (s, i) => s + Number(i.netAmount || 0),
      0
    );

    const avgSaleAmount = totalOrders
      ? Number((totalRevenue / totalOrders).toFixed(2))
      : 0;

    return res.json({
      noData: false,
      brand: brandName,
      day,
      branches,
      noOfSales: totalOrders,
      revenue: totalRevenue,
      netAmount: totalNet,
      taxTotal: totalTax,
      discountTotal: totalDiscount,
      items: brandItems,
      avgSaleAmount,
      totalItemQty,
      avgItemSellingPrice: totalItemQty
        ? Number((totalItemNet / totalItemQty).toFixed(2))
        : 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Failed using /sales/page",
      details: err?.message,
    });
  }
});


export default router
