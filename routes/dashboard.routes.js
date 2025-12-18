import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import Brand from '../models/brand.js'
import { ristaClient } from '../ristaClient.js'

const router = express.Router()

// -----------------------------
// DASHBOARD STATS
// -----------------------------
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { brandName } = req.user

    if (!brandName) {
      return res.status(400).json({
        message: 'No brand associated with this user',
      })
    }

    // ✅ FIXED: use brandName from JWT
    const brand = await Brand.findOne({ brandName })

    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' })
    }

    // 🟡 Brand approved but not yet onboarded in Rista
    if (!brand.ristaOutletId) {
      return res.status(200).json({
        brandName: brand.brandName,
        status: brand.status,
        eligibilityScore: brand.eligibilityScore,
        operational: false,
        message:
          'Brand approved but operational data is not available yet',
      })
    }

    // 🟢 Fetch real-time Rista data
    const orders = await ristaClient.getOrders(brand.ristaOutletId)

    const totalOrders = orders.length
    const activeOrders = orders.filter(
      (o) => o.status === 'active'
    ).length

    const revenue = orders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    )

    return res.json({
      brandName: brand.brandName,
      status: brand.status,
      eligibilityScore: brand.eligibilityScore,
      operational: true,
      totalOrders,
      activeOrders,
      revenue,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return res
      .status(500)
      .json({ message: 'Failed to load dashboard stats' })
  }
})

// -----------------------------
// LOW STOCK
// -----------------------------
router.get('/low-stock', authMiddleware, async (req, res) => {
  try {
    const { brandName } = req.user

    if (!brandName) {
      return res.status(400).json({
        message: 'No brand associated with this user',
      })
    }

    // ✅ FIXED
    const brand = await Brand.findOne({ brandName })

    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' })
    }

    // 🟡 Not operational yet
    if (!brand.ristaOutletId) {
      return res.status(200).json([])
    }

    const inventory = await ristaClient.getInventory(
      brand.ristaOutletId
    )

    const lowStockItems = inventory.filter(
      (item) => item.quantity < 10
    )

    return res.json(
      lowStockItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }))
    )
  } catch (error) {
    console.error('Low stock error:', error)
    return res
      .status(500)
      .json({ message: 'Failed to load stock data' })
  }
})

export default router
