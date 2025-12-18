import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    companyName: { type: String, required: true, trim: true },

    brandName: {
      type: String,
      default: null, // 🔑 IMPORTANT
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },
  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)
