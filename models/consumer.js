import mongoose from "mongoose";

const ConsumerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String
    }
  },
  { timestamps: true }
);

export default mongoose.model("Consumer", ConsumerSchema);
