import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/user.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendWalletTransactionEmail } from "../utils/walletMailer.js";
import { sendOrderNotificationEmails } from "../utils/orderMailer.js";
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
        dueAmount: 0,
        dueReason: null,
        transactions: []
      });
    }

    res.json({
      balance: user.wallet.balance || 0,
      dueAmount: user.wallet.dueAmount || 0,
      dueReason: user.wallet.dueReason || null,
      transactions: user.wallet.transactions || []
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
    // ----------------- AUTO CLEAR DUE -----------------
    if (user.wallet.dueAmount > 0) {
      const adjusted = Math.min(user.wallet.balance, user.wallet.dueAmount);

      user.wallet.balance -= adjusted;
      user.wallet.dueAmount -= adjusted;

      user.wallet.transactions.push({
        amount: adjusted,
        type: "debit",
        source: "system",
        reason: "Due adjustment"
      });

      if (user.wallet.dueAmount === 0) {
        user.wallet.dueReason = null;
      }
    }

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
    /* ================= NORMALIZE ITEMS FROM BREAKDOWN ================= */

const normalizedItems = items.map(item => {

  let breakdown = item.breakdown;

  // 🔥 FORCE SAFE OBJECT CONVERSION
  if (typeof breakdown === "string") {
    try {
      breakdown = JSON.parse(breakdown);
    } catch {
      // convert JS object string -> real object
      if (typeof breakdown === "string") {
        try {
          breakdown = JSON.parse(breakdown);
        } catch {
          breakdown = [];
        }
      }
    }
  }

  if (!Array.isArray(breakdown)) breakdown = [];

  breakdown = breakdown.map(r => ({
    item: String(r.item || ""),
    type: String(r.type || ""),
    qty: Number(r.qty || 0),
    uom: String(r.uom || ""),
    cost: Number(r.cost || 0),
    level: Number(r.level || 0)
  }));

    return {
    dish: item.dish,
    qty: Number(item.qty || 1),   // TRUST FRONTEND
    price: Number(item.price) || 0,
    total: Number(item.total) || 0,
    breakdown
  };
});


console.log("========= ORDER DEBUG =========");
console.log(JSON.stringify(normalizedItems, null, 2));
console.log("TYPE CHECK:");
normalizedItems.forEach((item, i) => {
  console.log("item", i, typeof item);
  console.log("breakdown is array:", Array.isArray(item.breakdown));
  if (item.breakdown)
    item.breakdown.forEach((b, j) =>
      console.log("  row", j, typeof b, b)
    );
});
console.log("================================");
const order = await Order.create({
  brand: user._id,
  items: normalizedItems,
  amount: payAmount,
  paymentMethod: "wallet",
  status: "PLACED",
  isSeenByAdmin: false
});

    /* ================= SEND ORDER NOTIFICATION EMAILS ================= */
    try {
      await sendOrderNotificationEmails({
        order,
        userEmail: user.email,
        brandName: user.brandName,
      });
    } catch (emailErr) {
      console.error("Order notification email error:", emailErr);
    }

    res.json({
      success: true,
      orderId: order._id,
      remainingBalance: user.wallet.balance
    });

  } catch (err) {
  console.log("====== REAL ERROR START ======");
  console.log(err);
  console.log(err.message);
  console.log(err.errors);
  console.log("====== REAL ERROR END ======");
  res.status(500).json({ message: err.message });
}
});

// ----------------- Admin: Add Due Amount -----------------
router.post(
  "/admin/wallet/due",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId, amount, reason } = req.body;

      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Brand not found" });
      }

      if (!user.wallet) {
        user.wallet = { balance: 0, transactions: [] };
      }

      user.wallet.dueAmount =
        Number(user.wallet.dueAmount || 0) + Number(amount);

      user.wallet.dueReason = reason || "Pending payment";

      await user.save();

      res.json({
        success: true,
        dueAmount: user.wallet.dueAmount
      });
    } catch (err) {
      console.error("Add due error:", err);
      res.status(500).json({ message: "Failed to add due" });
    }
  }
);


export default router;
