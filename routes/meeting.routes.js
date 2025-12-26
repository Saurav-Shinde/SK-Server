import express from 'express'
import { scheduleMeeting } from '../controllers/meeting.controller.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

router.post('/schedule', authMiddleware, scheduleMeeting)

export default router
