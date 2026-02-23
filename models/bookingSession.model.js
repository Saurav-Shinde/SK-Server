import mongoose from "mongoose";

/**
 * BookingSession holds a temporary reservation for a meeting booking.
 * IMPORTANT: No wallet money is deducted at HOLD stage; we treat it as a soft hold.
 * Confirmation endpoint will permanently deduct wallet using a transaction.
 */
const bookingSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["HOLD", "CONFIRMED", "EXPIRED"],
      default: "HOLD",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB will automatically delete documents after expiresAt.
bookingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("BookingSession", bookingSessionSchema);

