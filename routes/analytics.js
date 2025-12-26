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
    const { period, branches: queryBranches } = req.query || {}

    if (!period) {
      return res.status(400).json({
        message: 'period is required (YYYY-MM or YYYY-MM-DD)',
      })
    }

    const brandName = req.user?.brandName
    if (!brandName) {
      return res.status(401).json({ message: 'brandName missing in token' })
    }

    const brandKey = normalize(brandName)

    let branches = []

    if (queryBranches) {
      branches = Array.isArray(queryBranches)
        ? queryBranches
        : [queryBranches]
    } else {
      const brandDoc = await Brand.findOne({ brandName })

      if (!brandDoc) {
        return res.json({
          noData: true,
          reason: 'brand_not_found',
          message: 'Brand not found in system',
        })
      }

      if (brandDoc?.ristaBranchCodes?.length)
        branches = brandDoc.ristaBranchCodes
      else if (brandDoc?.ristaBranchCode)
        branches = [brandDoc.ristaBranchCode]
    }

    branches = [...new Set(branches.filter(Boolean))]

    const results = await Promise.all(
      branches.map(branch =>
        ristaClient
          .getAnalyticsSummary({ branch, period })
          .catch(() => null)
      )
    )

    const validResults = results.filter(Boolean)
    if (!validResults.length) {
      return res.json({
        noData: true,
        reason: 'rista_unreachable',
        message: 'Could not reach Rista',
      })
    }

    let allItems = []
    let totalOrders = 0
    let totalRevenue = 0
    let totalNet = 0
    let totalDiscount = 0
    let totalTax = 0

    for (const data of validResults) {
      totalOrders += Number(data.noOfSales || 0)
      totalRevenue += Number(data.revenue || 0)
      totalNet += Number(data.netAmount || 0)
      totalDiscount += Number(data.discountTotal || 0)
      totalTax += Number(data.taxTotal || 0)

      if (Array.isArray(data.items)) allItems.push(...data.items)
    }

    if (!allItems.length) {
      return res.json({
        noData: true,
        reason: 'no_sales',
        message: 'No sales found for this period',
      })
    }

    const brandItems = allItems.filter(i =>
      normalize(i?.accountName || i?.brandName || '').includes(brandKey)
    )

    if (!brandItems.length) {
      return res.json({
        noData: true,
        reason: 'brand_items_not_found',
        message: 'Brand not found in Rista data',
      })
    }

    const aggregated = {
      brand: brandName,
      branches,
      noOfSales: totalOrders,
      revenue: totalRevenue,
      netAmount: totalNet,
      taxTotal: totalTax,
      discountTotal: totalDiscount,
      items: brandItems,
      avgSaleAmount:
        totalOrders ? Number((totalRevenue / totalOrders).toFixed(2)) : 0
    }

    return res.json({ noData: false, ...aggregated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      message: 'Failed to fetch analytics',
      details: err?.message,
    })
  }
})

export default router
