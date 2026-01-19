import User from '../models/user.js'
import Meeting from '../models/meeting.js'

const MEETING_COST = 30

export const scheduleMeeting = async (req, res) => {
  try {
    const userId = req.user._id
    const { name, email, date, notes } = req.body

    if (!date) {
      return res.status(400).json({
        message: 'Meeting date is required.'
      })
    }

    // 1️⃣ Fetch user
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      })
    }

    // 2️⃣ Check wallet balance
    if (!user.wallet || user.wallet.balance < MEETING_COST) {
      return res.status(400).json({
        message: `Insufficient wallet balance. ₹${MEETING_COST} required.`
      })
    }

    // 3️⃣ Deduct from wallet
    user.wallet.balance -= MEETING_COST

    user.wallet.transactions.push({
      amount: MEETING_COST,
      type: 'debit',
      source: 'system',
      reason: 'Meeting Scheduled',
      date: new Date()
    })

    await user.save()

    // 4️⃣ Save meeting
    const meeting = await Meeting.create({
      user: userId,
      name,
      email,
      date,
      notes,
      amountCharged: MEETING_COST
    })

    // 5️⃣ Respond
    res.status(201).json({
      success: true,
      message: `Meeting scheduled successfully. ₹${MEETING_COST} deducted from wallet.`,
      remainingBalance: user.wallet.balance,
      meeting
    })

  } catch (err) {
    console.error('Meeting schedule error:', err)
    res.status(500).json({
      message: 'Unable to schedule meeting.'
    })
  }
}
