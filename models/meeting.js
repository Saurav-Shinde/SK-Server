import mongoose from 'mongoose'

const MeetingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    email: String,
    date: Date,
    notes: String
  },
  { timestamps: true }
)

export default mongoose.model('Meeting', MeetingSchema)
