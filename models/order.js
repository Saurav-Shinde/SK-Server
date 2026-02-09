// models/order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    items: [
      {
        dish: String,
        qty: Number,
        price: Number,
        total: Number
      }
    ],
    amount: Number,
    paymentMethod: {
      type: String,
      enum: ["wallet"],
      default: "wallet"
    },
    status: {
      type: String,
      enum: ["PLACED", "PREPARING", "COMPLETED", "CANCELLED"],
      default: "PLACED"
    },
    isSeenByAdmin: {
      type: Boolean,
      default: false
    },
    isReceived: {
      type: Boolean,
      default: false
    },
    receivedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    }

  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
