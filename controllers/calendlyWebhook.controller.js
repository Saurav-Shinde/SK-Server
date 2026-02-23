import User from "../models/user.js";
import Meeting from "../models/meeting.js";

const MEETING_COST_PER_HOUR_BLOCK = 30;

export const handleCalendlyWebhook = async (req, res) => {
  try {
    console.log("CALENDLY WEBHOOK HIT");

    const payload = req.body;

    // only process booking event
    if (payload.event !== "invitee.created") {
      return res.sendStatus(200);
    }

    const email =
      payload.payload?.email?.toLowerCase() ||
      payload.payload?.invitee?.email?.toLowerCase();

    if (!email) {
      console.log("No email found");
      return res.sendStatus(200);
    }

    const startTime = new Date(payload.payload?.event?.start_time);
    const endTime = new Date(payload.payload?.event?.end_time);

    const user = await User.findOne({ email });

    if (!user) {
      console.log("User not found:", email);
      return res.sendStatus(200);
    }

    if (!user.wallet || user.wallet.balance < MEETING_COST_PER_HOUR_BLOCK) {
      console.log("Insufficient wallet balance");
      return res.sendStatus(200);
    }

    // 💰 deduct wallet
    user.wallet.balance -= MEETING_COST_PER_HOUR_BLOCK;

    user.wallet.transactions.push({
      amount: MEETING_COST_PER_HOUR_BLOCK,
      type: "debit",
      source: "system",
      reason: "Meeting Slot Booked (Calendly)",
      createdAt: new Date(),
    });

    await user.save();

    await Meeting.create({
      user: user._id,
      email,
      attendeeEmail: email,
      startTime,
      endTime,
      date: startTime,
      amountCharged: MEETING_COST_PER_HOUR_BLOCK,
      status: "scheduled",
      billingStatus: "charged",
      source: "calendly_webhook",
    });

    console.log("Wallet deducted successfully");

    res.sendStatus(200);
  } catch (err) {
    console.error("Calendly Webhook Error:", err);
    res.sendStatus(200);
  }
};