import express from 'express'
import {
  handleCalendlyWebhook,
  confirmBookingSession,
  startBookingSession,
  scheduleMeeting,
} from '../controllers/meeting.controller.js'
import { authMiddleware } from '../middleware/auth.js'


const router = express.Router()

router.post('/schedule', authMiddleware, scheduleMeeting)
router.post("/start", authMiddleware, startBookingSession);
router.post("/confirm", authMiddleware, confirmBookingSession);
router.post("/calendly/webhook", express.json(), handleCalendlyWebhook);

export default router
