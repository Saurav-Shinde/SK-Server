import express from 'express'
import { submitEligibility } from '../controllers/eligibility.controller.js'

const router = express.Router()

router.post('/', submitEligibility)

export default router
