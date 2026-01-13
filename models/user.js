import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    brandName: {
      type: String,
      default: null,
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

    address: {
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true }
    },

    // 🧠 Free meeting credits
    credits: {
      type: Number,
      default: 1000
    },

    // 💳 Paid wallet
    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [
        {
          amount: Number,
          type: { type: String, enum: ["credit", "debit"] },
          source: { type: String, enum: ["razorpay", "system"] },
          reason: String,
          date: { type: Date, default: Date.now }
        }
      ]
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
