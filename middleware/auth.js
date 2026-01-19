import jwt from "jsonwebtoken";
import Vendor from "../models/vendor.js";
import User from "../models/user.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔐 ADMIN SHORT-CIRCUIT (NO DB)
    if (decoded.role === "admin") {
      req.user = { role: "admin" };
      return next();
    }
    
    let user;

    // 🔑 YOUR TOKEN STRUCTURE
    // decoded = { vendorId, role, iat, exp }
    if (decoded.role === "vendor") {
      user = await Vendor.findById(decoded.vendorId).lean();
    } else {
      user = await User.findById(decoded.userId || decoded.id).lean();
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ Attach FULL DB DOCUMENT
    req.user = user;
    req.user.role = decoded.role;

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
