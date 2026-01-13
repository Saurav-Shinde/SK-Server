import User from "../models/user.js";

export const getUserCredits = async (req, res) => {
  try {
    // 🔐 Only clients are allowed to see credits
    if (req.user.role !== "client") {
      return res.status(403).json({
        message: "Credits are only available for client accounts"
      });
    }

    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("credits");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      credits: user.credits ?? 0
    });

  } catch (err) {
    console.error("Get credits error:", err);
    return res.status(500).json({
      message: "Unable to fetch credits, please try again later"
    });
  }
};
