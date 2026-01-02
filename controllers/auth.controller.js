import User from '../models/user.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Vendor from '../models/vendor.js'

const createToken = (user) => {
  const secret = process.env.JWT_SECRET || 'development-secret'

  return jwt.sign(
    {
      userId: user._id,
      brandName: user.brandName,
    },
    secret,
    { expiresIn: '7d' }
  )
}

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  brandName: user.brandName,
  email: user.email,
  address: user.address,
})

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

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // CLIENT SIGNUP
    if (userType === "client") {
      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(409).json({ message: "Email already exists" });

      const user = await User.create({
        name,
        brandName,
        email: normalizedEmail,
        password: hashedPassword,
        address
      });

      const token = jwt.sign(
        { userId: user._id, role: "client" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: "Client account created",
        role: "client",
        token
      });
    }

    // VENDOR SIGNUP
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

      const token = jwt.sign(
        { vendorId: vendor._id, role: "vendor" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: "Vendor account created",
        role: "vendor",
        token
      });
    }

    return res.status(400).json({ message: "Invalid user type" });

  } catch (err) {
  console.error("Signup error details:", err);
  return res.status(500).json({ message: err.message });
}

};


export const getCredits = async (req, res) => {
  try {
    const userId = req.user?.userId // set by authMiddleware

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Only fetch what we need
    const user = await User.findById(userId).select('credits name email')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      success: true,
      credits: user.credits || 0,
      name: user.name,
      email: user.email,
    })
  } catch (err) {
    console.error('Credits fetch error:', err)
    return res
      .status(500)
      .json({ message: 'Unable to fetch credits, please try again later.' })
  }
}
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase();

    // 1️⃣ Try CLIENT user first
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const token = createToken(user);

      return res.json({
        message: "Client login successful",
        userType: "client",
        token,
        user: sanitizeUser(user)
      });
    }

    // 2️⃣ Try VENDOR next
    let vendor = await Vendor.findOne({ email: normalizedEmail });

    if (!vendor) {
      return res.status(404).json({ message: "Account not found." });
    }

    const vendorMatch = await bcrypt.compare(password, vendor.password);
    if (!vendorMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // vendor token
    const token = jwt.sign(
      {
        vendorId: vendor._id,
        storeName: vendor.storeName
      },
      process.env.JWT_SECRET || "development-secret",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Vendor login successful",
      userType: "vendor",
      token,
      vendor: {
        id: vendor._id,
        supplierName: vendor.supplierName,
        storeName: vendor.storeName,
        email: vendor.email,
        address: vendor.address,
        fssai: vendor.fssai,
        pan: vendor.pan
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Unable to login. Please try again." });
  }
};
