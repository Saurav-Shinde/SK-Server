import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/user.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ---------------- Get wallet ---------------- */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("wallet");
    res.json(user.wallet || { balance: 0, transactions: [] });
  } catch (err) {
    console.error("Wallet fetch error:", err);
    res.status(500).json({ message: "Wallet fetch failed" });
  }
});

/* ---------------- Create Razorpay order ---------------- */
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    let { amount } = req.body;
    amount = Number(amount);

    if (!amount || amount < 10) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `w${Date.now().toString().slice(-8)}`
    });

    res.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ message: "Razorpay order failed" });
  }
});

/* ---------------- Transactions ---------------- */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("wallet");

    res.json(user.wallet);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch wallet" });
  }
});

/* ---------------- Verify payment & credit wallet ---------------- */
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const user = await User.findById(req.user.userId);

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
    }

    user.wallet.balance += Number(amount);
    user.wallet.transactions.push({
      amount,
      type: "credit",
      source: "razorpay",
      reason: "Wallet recharge"
    });

    await user.save();

    res.json({ success: true, balance: user.wallet.balance });
  } catch (err) {
    console.error("Wallet credit error:", err);
    res.status(500).json({ message: "Wallet update failed" });
  }
});

export default router;
