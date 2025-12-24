import express from 'express'
import { ristaClient } from '../ristaClient.js'

const router = express.Router()

// GET /api/analytics/sales/summary?branch=<code>&period=<YYYY-MM or YYYY-MM-DD>
router.get('/sales/summary', async (req, res) => {
  try {
    const { branch, period } = req.query || {}

    if (!branch || !period) {
      return res.status(400).json({
        message: 'branch and period are required',
      })
    }

    const data = await ristaClient.getAnalyticsSummary({
      branch,
      period,
    })

    return res.json(data)

  } catch (error) {
    const status = error?.response?.status || 500
    const payload = error?.response?.data || { message: error.message }

    console.error('[ANALYTICS] summary error:', payload)
    return res.status(status).json({
      message: 'Failed to fetch analytics summary',
      details: payload,
    })
  }
})

export default router


