import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import User from "../models/user.js";

const router = express.Router();

router.post("/from-wallet", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.wallet || typeof user.wallet.balance !== "number") {
      return res.status(400).json({ message: "Wallet not initialized" });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // ✅ Deduct wallet
    user.wallet.balance -= amount;

    // ✅ Add meeting credits
    user.credits += amount;

    // ✅ Store transaction
    user.wallet.transactions.push({
      amount,
      type: "debit",
      source: "system",
      reason: "Converted to meeting credits"
    });

    await user.save();

    res.json({
      success: true,
      wallet: user.wallet,
      credits: user.credits
    });
  } catch (err) {
    console.error("Wallet → Credits error:", err);
    res.status(500).json({ message: "Transfer failed" });
  }
});

export default router;
