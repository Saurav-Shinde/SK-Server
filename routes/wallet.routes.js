import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/user.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendWalletTransactionEmail } from "../utils/walletMailer.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import Order from "../models/order.js";

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wallet");

    if (!user || !user.wallet) {
      return res.json({
        balance: 0,
        transactions: []
      });
    }

    res.json({
      balance: user.wallet.balance,
      transactions: user.wallet.transactions
    });
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



/* ---------------- Verify payment & credit wallet ---------------- */
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("Missing Razorpay fields");
      return res.status(400).json({ message: "Invalid Razorpay response" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");


    if (expected !== razorpay_signature) {
      console.error("Signature mismatch");
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
    }

    const amt = Number(amount);

    user.wallet.balance += amt;

    user.wallet.transactions.push({
      amount: amt,
      type: "credit",
      source: "razorpay",
      reason: "Wallet recharge"
    });

    await user.save();

    console.log("Wallet updated. Sending email…");

    await sendWalletTransactionEmail({
      to: user.email,
      amount: amt,
      type: "credit",
      source: "razorpay",
      reason: "Wallet recharge",
      balance: user.wallet.balance,
      brandName: user.brandName
    });

    console.log("Email sent.");

    res.json({ success: true, balance: user.wallet.balance });

  } catch (err) {
    console.error("Wallet verify error:", err);
    res.status(500).json({ message: "Wallet update failed" });
  }
});

/*-----------------Admin Wallet Deduction-----------------*/
router.post(
  "/admin/deduct",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { userId, amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({ message: "Amount and reason required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Brand not found" });
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
    }

    user.wallet.balance -= Number(amount);

    user.wallet.transactions.push({
      type: "debit",
      amount: Number(amount),
      reason,
      source: "admin"
    });

    await user.save();

    res.json({
      message: "Wallet deducted",
      balance: user.wallet.balance
    });
  }
);

router.post("/pay", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, items } = req.body;

    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
    }

    if (user.wallet.balance < payAmount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    /* ================= WALLET DEDUCTION ================= */
    user.wallet.balance -= payAmount;

    user.wallet.transactions.push({
      type: "debit",
      amount: payAmount,
      source: "admin", // MUST match enum
      reason: "ORDER_PAYMENT"
    });

    await user.save();

    /* ================= CREATE ORDER ================= */
    const order = await Order.create({
      brand: user._id,
      items,
      amount: payAmount,
      paymentMethod: "wallet",
      status: "PLACED"
    });

    res.json({
      success: true,
      orderId: order._id,
      remainingBalance: user.wallet.balance
    });

  } catch (err) {
    console.error("❌ Wallet pay error:", err);
    res.status(500).json({ message: "Wallet payment failed" });
  }
});



export default router;
