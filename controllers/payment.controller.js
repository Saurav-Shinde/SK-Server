import express from "express";
import Razorpay from "razorpay";

export const payment = async (req,res) => {
    try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // ₹ → paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment order failed" });
  }
}