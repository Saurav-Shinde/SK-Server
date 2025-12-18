import mongoose from 'mongoose'

const brandSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },

    eligibilityScore: Number,

    // Rista mapping (can be filled later)
    ristaOutletId: { type: String, default: null },
    ristaBusinessId: { type: String, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

export default mongoose.model('Brand', brandSchema)
