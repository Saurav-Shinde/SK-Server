import User from "../models/user.js";

export const getUserCredits = async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware

    const user = await User.findById(userId).select("credits");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      credits: user.credits ?? 0,
    });
  } catch (err) {
    console.error("Get credits error:", err);
    res.status(500).json({ message: "Unable to fetch credits" });
  }
};
