import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import Brand from '../models/brand.js'
import { ristaClient } from '../ristaClient.js'

const router = express.Router()

// Optional brand → branches mapping (augment DB)
const BRAND_BRANCHES = {
  // 'Example Brand': ['BR1', 'BR2'],
}

const mergeChannelSummary = (entries) => {
  const map = new Map()
  for (const e of entries) {
    const name = e?.name
    if (!name) continue
    const curr = map.get(name) || {
      name,
      noOfSales: 0,
      netSaleAmount: 0,
      discount: 0,
      taxAmount: 0,
    }
    curr.noOfSales += Number(e.noOfSales || 0)
    curr.netSaleAmount += Number(e.netSaleAmount || 0)
    curr.discount += Number(e.discount || 0)
    curr.taxAmount += Number(e.taxAmount || 0)
    map.set(name, curr)
  }
  return Array.from(map.values())
}

// GET /api/analytics/sales/summary?period=<YYYY-MM or YYYY-MM-DD>
// Branches are resolved from brandName (JWT) and DB/mapping. No branch query param accepted.
router.get('/sales/summary', authMiddleware, async (req, res) => {
    try {
      const { period, branches: queryBranches } = req.query || {};
  
      if (!period) {
        return res.status(400).json({
          message: 'period is required (YYYY-MM or YYYY-MM-DD)',
        });
      }
  
      const brandName = req.user?.brandName;
      if (!brandName) {
        return res.status(401).json({
          message: 'brandName missing in token',
        });
      }
  
      // -----------------------------------
      // 1️⃣ Build branch list (priority order)
      // -----------------------------------
      let branches = [];
  
      // a) if UI passed branches -> use those
      if (queryBranches) {
        branches = Array.isArray(queryBranches)
          ? queryBranches
          : [queryBranches];
      }
  
      // b) otherwise -> read from DB
      if (branches.length === 0) {
        const brandDoc = await Brand.findOne({ brandName });
  
        if (brandDoc?.ristaBranchCodes?.length) {
          // array version (if your schema supports it)
          branches = brandDoc.ristaBranchCodes;
        } else if (brandDoc?.ristaBranchCode) {
          // single value version (existing schema)
          branches = [brandDoc.ristaBranchCode];
        }
      }
  
      // c) fallback mapping
      if (branches.length === 0 && BRAND_BRANCHES[brandName]) {
        branches = BRAND_BRANCHES[brandName];
      }
  
      // dedupe + cleanup
      branches = Array.from(new Set(branches.filter(Boolean)));
  
      // -----------------------------------
      // 2️⃣ If still empty → return zeroes
      // -----------------------------------
      if (branches.length === 0) {
        return res.json({
          noOfSales: 0,
          avgSaleAmount: 0,
          revenue: 0,
          netAmount: 0,
          taxTotal: 0,
          discountTotal: 0,
          chargeTotal: 0,
          balanceAmount: 0,
          noOfPeople: 0,
          items: [],
          channelSummary: [],
        });
      }
  
      console.log("🟡 BRAND:", brandName);
      console.log("🟡 RESOLVED BRANCHES:", branches);
  
      // -----------------------------------
      // 3️⃣ Call Rista per branch
      // -----------------------------------
      const results = await Promise.all(
        branches.map((branch) =>
          ristaClient.getAnalyticsSummary({ branch, period }).catch((err) => {
            console.error('[ANALYTICS] branch fetch failed', {
              branch,
              err: err?.response?.data || err.message,
            });
            return {};
          })
        )
      );
  
      // -----------------------------------
      // 4️⃣ Aggregate
      // -----------------------------------
      const aggregated = {
        noOfSales: 0,
        revenue: 0,
        netAmount: 0,
        taxTotal: 0,
        discountTotal: 0,
        chargeTotal: 0,
        balanceAmount: 0,
        noOfPeople: 0,
        items: [],
        channelSummary: [],
      };
  
      for (const data of results) {
        aggregated.noOfSales += Number(data.noOfSales || 0);
        aggregated.revenue += Number(data.revenue || 0);
        aggregated.netAmount += Number(data.netAmount || 0);
        aggregated.taxTotal += Number(data.taxTotal || 0);
        aggregated.discountTotal += Number(data.discountTotal || 0);
        aggregated.chargeTotal += Number(data.chargeTotal || 0);
        aggregated.balanceAmount += Number(data.balanceAmount || 0);
        aggregated.noOfPeople += Number(data.noOfPeople || 0);
  
        if (Array.isArray(data.items)) aggregated.items.push(...data.items);
        if (Array.isArray(data.channelSummary)) aggregated.channelSummary.push(...data.channelSummary);
      }
  
      aggregated.channelSummary = mergeChannelSummary(aggregated.channelSummary);
  
      aggregated.avgSaleAmount =
        aggregated.noOfSales > 0
          ? Number((aggregated.revenue / aggregated.noOfSales).toFixed(2))
          : 0;
  
      return res.json(aggregated);
  
    } catch (error) {
      console.error('[ANALYTICS] summary error:', error?.response?.data || error.message);
  
      return res.status(error?.response?.status || 500).json({
        message: 'Failed to fetch analytics summary',
        details: error?.response?.data || error.message,
      });
    }
  });
  

export default router
