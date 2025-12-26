import User from '../models/user.js'
import Meeting from '../models/meeting.js'

export const scheduleMeeting = async (req, res) => {
  try {
    const userId = req.user.userId

    const { name, email, date, notes } = req.body

    if (!date) {
      return res.status(400).json({ message: 'Meeting date is required.' })
    }

    // 1) Deduct credits atomically (only if ≥ 20)
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 20 } },
      { $inc: { credits: -20 } },
      { new: true }
    )

    if (!updatedUser) {
      return res.status(400).json({
        message: 'Insufficient credits. Need 20 credits to schedule a meeting.'
      })
    }

    // 2) Save the meeting
    const meeting = await Meeting.create({
      user: userId,
      name,
      email,
      date,
      notes
    })

    // 3) Respond
    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully. 20 credits deducted.',
      remainingCredits: updatedUser.credits,
      meeting
    })

  } catch (err) {
    console.error('Meeting schedule error:', err)
    res.status(500).json({ message: 'Unable to schedule meeting.' })
  }
}
