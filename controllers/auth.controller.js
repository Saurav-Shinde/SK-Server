import User from "../models/user.js";
import Vendor from "../models/vendor.js";
import Consumer from "../models/consumer.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const createToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "development-secret", {
    expiresIn: "7d"
  });
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  brandName: user.brandName,
  email: user.email,
  address: user.address
});

/* ---------------- SIGNUP ---------------- */
export const signup = async (req, res) => {
  try {
    const {
      userType,
      name,
      brandName,
      email,
      password,
      address,
      fssai,
      pan
    } = req.body;

    const normalizedEmail = email.toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ---------- CLIENT ---------- */
    if (userType === "client") {
      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(409).json({ message: "Email already exists" });

      const sameBrandUser = await User.findOne({ brandName });
      const signupCredits = sameBrandUser ? 0 : 3000;

      const user = await User.create({
        name,
        brandName,
        email: normalizedEmail,
        password: hashedPassword,
        address,
        credits: signupCredits,
        wallet: { balance: 0, transactions: [] }
      });


      const token = createToken({ userId: user._id, role: "client" });

      return res.status(201).json({
        message: "Client account created",
        role: "client",
        credits: user.credits,
        token
      });
    }

    /* ---------- VENDOR ---------- */
    if (userType === "vendor") {
      const exists = await Vendor.findOne({ email: normalizedEmail });
      if (exists) return res.status(409).json({ message: "Vendor already exists" });

      const vendor = await Vendor.create({
        supplierName: name,
        storeName: brandName,
        email: normalizedEmail,
        password: hashedPassword,
        address,
        fssai,
        pan
      });

      const token = createToken({ vendorId: vendor._id, role: "vendor" });

      return res.status(201).json({
        message: "Vendor account created",
        role: "vendor",
        token
      });
    }

    /* ---------- CONSUMER ---------- */
    if (userType === "consumer") {
      const exists = await Consumer.findOne({ email: normalizedEmail });
      if (exists) return res.status(409).json({ message: "Email already exists" });

      const consumer = await Consumer.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        address
      });

      const token = createToken({ consumerId: consumer._id, role: "consumer" });

      return res.status(201).json({
        message: "Consumer account created",
        role: "consumer",
        token
      });
    }

    return res.status(400).json({ message: "Invalid user type" });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ---------------- LOGIN ---------------- */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    /* ---------- CLIENT ---------- */
    let user = await User.findOne({ email: normalizedEmail });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = createToken({ userId: user._id, role: "client" });
      return res.json({
        userType: "client",
        token,
        user: sanitizeUser(user)
      });
    }

    /* ---------- VENDOR ---------- */
    let vendor = await Vendor.findOne({ email: normalizedEmail });
    if (vendor && (await bcrypt.compare(password, vendor.password))) {
      const token = createToken({ vendorId: vendor._id, role: "vendor" });
      return res.json({
        userType: "vendor",
        token,
        vendor
      });
    }

    /* ---------- CONSUMER ---------- */
    let consumer = await Consumer.findOne({ email: normalizedEmail });
    if (consumer && (await bcrypt.compare(password, consumer.password))) {
      const token = createToken({ consumerId: consumer._id, role: "consumer" });
      return res.json({
        userType: "consumer",
        token,
        consumer: {
          id: consumer._id,
          name: consumer.name,
          email: consumer.email,
          address: consumer.address
        }
      });
    }

    return res.status(401).json({ message: "Invalid email or password" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

/* ---------------- CREDITS (CLIENT ONLY) ---------------- */
export const getCredits = async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Not allowed" });
    }

    const user = await User.findById(req.user.userId).select("credits name email");

    return res.json({
      success: true,
      credits: user.credits || 0,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    return res.status(500).json({ message: "Unable to fetch credits" });
  }
};
