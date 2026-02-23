import User from '../models/user.js'
import Meeting from '../models/meeting.js'
import BookingSession from "../models/bookingSession.model.js";
import mongoose from "mongoose";
import {
  listIncrementalCalendarEvents,
  recordWebhookReceived,
  validateWebhookChannel,
} from "../services/googleCalendar.service.js";

const MEETING_COST_PER_HOUR_BLOCK = 30;
const DAILY_SPENDING_LIMIT = 300;
const BOOKING_HOLD_AMOUNT = 50;
const BOOKING_HOLD_MINUTES = 10;

const getCalendlyBookingUrl = (sessionId) => {
  const base =
    process.env.CALENDLY_BASE_URL ||
    "https://calendly.com/YOUR_USERNAME/30min";
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}sessionId=${sessionId}`;
};

/**
 * Sum all active HOLD sessions for the user (optionally excluding one session).
 * This provides a soft-hold so users can't start unlimited sessions and oversubscribe wallet.
 */
const sumActiveHolds = async (userId, excludeSessionId = null) => {
  const match = {
    userId: new mongoose.Types.ObjectId(userId),
    status: "HOLD",
    expiresAt: { $gt: new Date() },
  };
  if (excludeSessionId) {
    match._id = { $ne: new mongoose.Types.ObjectId(excludeSessionId) };
  }
  const agg = await BookingSession.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return Number(agg[0]?.total || 0);
};

const getDayRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const parseEventTimes = (event) => {
  const startRaw = event?.start?.dateTime || event?.start?.date;
  const endRaw = event?.end?.dateTime || event?.end?.date;
  const startTime = startRaw ? new Date(startRaw) : null;
  const endTime = endRaw ? new Date(endRaw) : null;

  if (!startTime || !endTime || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return null;
  }

  return { startTime, endTime };
};

const calculateMeetingCost = (startTime, endTime) => {
  const durationMinutes = Math.max(
    1,
    Math.ceil((endTime.getTime() - startTime.getTime()) / 60000)
  );
  const hourBlocks = Math.max(1, Math.ceil(durationMinutes / 60));
  return {
    durationMinutes,
    hourBlocks,
    cost: hourBlocks * MEETING_COST_PER_HOUR_BLOCK,
  };
};

const emitWalletUpdate = (req, userId, newBalance) => {
  // Socket server is optional. If available, broadcast live wallet updates.
  const io = req?.app?.get?.("io");
  if (!io) return;
  io.to(String(userId)).emit("wallet:update", newBalance);
};

export const scheduleMeeting = async (req, res) => {
  try {
    const userId = req.user._id
    const { name, email, date, notes } = req.body

    if (!date) {
      return res.status(400).json({
        message: 'Meeting date is required.'
      })
    }

    // 1️⃣ Fetch user
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      })
    }

    // Backward-compatible manual scheduling path.
    if (!user.wallet || user.wallet.balance < MEETING_COST_PER_HOUR_BLOCK) {
      return res.status(400).json({
        message: `Insufficient wallet balance. ₹${MEETING_COST_PER_HOUR_BLOCK} required.`
      })
    }

    user.wallet.balance -= MEETING_COST_PER_HOUR_BLOCK

    user.wallet.transactions.push({
      amount: MEETING_COST_PER_HOUR_BLOCK,
      type: 'debit',
      source: 'system',
      reason: 'Meeting Scheduled',
      createdAt: new Date()
    })

    await user.save()
    emitWalletUpdate(req, user._id, user.wallet.balance);

    const meeting = await Meeting.create({
      user: userId,
      name,
      email,
      date,
      notes,
      attendeeEmail: (email || user.email || "").toLowerCase(),
      startTime: new Date(date),
      endTime: new Date(new Date(date).getTime() + 60 * 60000),
      amountCharged: MEETING_COST_PER_HOUR_BLOCK,
      status: "scheduled",
      billingStatus: "charged",
      source: "manual",
    })

    res.status(201).json({
      success: true,
      message: `Meeting scheduled successfully. ₹${MEETING_COST_PER_HOUR_BLOCK} deducted from wallet.`,
      remainingBalance: user.wallet.balance,
      meeting
    })

  } catch (err) {
    console.error('Meeting schedule error:', err)
    res.status(500).json({
      message: 'Unable to schedule meeting.'
    })
  }
}

/**
 * POST /api/meeting/start
 * Creates a booking session in HOLD state and returns a Calendly URL with sessionId.
 * No wallet money is deducted here.
 */
export const startBookingSession = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("wallet");
    if (!user?.wallet) {
      return res.status(400).json({ message: "Wallet not found" });
    }

    const heldTotal = await sumActiveHolds(userId);
    const available = Number(user.wallet.balance || 0) - heldTotal;
    if (available < BOOKING_HOLD_AMOUNT) {
      return res.status(400).json({
        message: `Insufficient wallet balance. ₹${BOOKING_HOLD_AMOUNT} required.`,
      });
    }

    const expiresAt = new Date(Date.now() + BOOKING_HOLD_MINUTES * 60 * 1000);
    const session = await BookingSession.create({
      userId,
      amount: BOOKING_HOLD_AMOUNT,
      status: "HOLD",
      expiresAt,
    });

    return res.status(201).json({
      bookingUrl: getCalendlyBookingUrl(session._id.toString()),
      sessionId: session._id,
      expiresAt,
    });
  } catch (err) {
    console.error("startBookingSession error:", err);
    return res.status(500).json({ message: "Failed to start booking session" });
  }
};

/**
 * POST /api/meeting/confirm
 * Confirms a HOLD session and permanently deducts wallet.
 * Uses a transaction to update user + booking session atomically.
 */
export const confirmBookingSession = async (req, res) => {
  const { sessionId } = req.body || {};
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

  const now = new Date();
  const mongoSession = await mongoose.startSession();

  try {
    let result = null;

    await mongoSession.withTransaction(async () => {
      const booking = await BookingSession.findById(sessionId).session(mongoSession);
      if (!booking) throw Object.assign(new Error("Booking session not found"), { statusCode: 404 });
      if (String(booking.userId) !== String(userId)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

      if (booking.status !== "HOLD") {
        throw Object.assign(new Error("Session already processed"), { statusCode: 400 });
      }

      if (booking.expiresAt <= now) {
        booking.status = "EXPIRED";
        await booking.save({ session: mongoSession });
        throw Object.assign(new Error("Session expired"), { statusCode: 400 });
      }

      const user = await User.findById(userId).select("wallet").session(mongoSession);
      if (!user?.wallet) throw Object.assign(new Error("Wallet not found"), { statusCode: 400 });

      // Ensure sufficient balance at confirmation time (wallet may have changed since HOLD).
      const otherHeldTotal = await sumActiveHolds(userId, booking._id);
      const available = Number(user.wallet.balance || 0) - otherHeldTotal;
      if (available < Number(booking.amount)) {
        throw Object.assign(new Error("Insufficient wallet balance to confirm booking"), { statusCode: 400 });
      }

      user.wallet.balance -= Number(booking.amount);
      user.wallet.transactions.push({
        amount: Number(booking.amount),
        type: "debit",
        source: "system",
        reason: "Meeting Booking Confirmed (Calendly)",
        createdAt: new Date(),
      });

      await user.save({ session: mongoSession });
      emitWalletUpdate(req, user._id, user.wallet.balance);

      booking.status = "CONFIRMED";
      await booking.save({ session: mongoSession });

      result = { remainingBalance: user.wallet.balance, amountDeducted: booking.amount };
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message || "Confirm failed" });
  } finally {
    mongoSession.endSession();
  }
};

export const handleCalendlyWebhook = async (req, res) => {
  try {
    console.log("CALENDLY WEBHOOK HIT");

    const event = req.body;

    if (event.event !== "invitee.created") return res.sendStatus(200);

    const email = event.payload.email?.toLowerCase();
    const startTime = new Date(event.payload.start_time);
    const endTime = new Date(event.payload.end_time);

    const user = await User.findOne({ email });
    if (!user || !user.wallet) return res.sendStatus(200);

    const { cost } = calculateMeetingCost(startTime, endTime);

    if (user.wallet.balance < cost) {
      console.log("Insufficient wallet");
      return res.sendStatus(200);
    }

    user.wallet.balance -= cost;

    user.wallet.transactions.push({
      amount: cost,
      type: "debit",
      source: "system",
      reason: "Meeting Slot Booked (Calendly)",
      createdAt: new Date()
    });

    await user.save();
    emitWalletUpdate(req, user._id, user.wallet.balance);

    await Meeting.create({
      user: user._id,
      name: user.name,
      email: user.email,
      attendeeEmail: email,
      date: startTime,
      startTime,
      endTime,
      notes: "Calendly booking",
      amountCharged: cost,
      status: "scheduled",
      billingStatus: "charged",
      source: "calendly_webhook",
    });

    console.log("Wallet deducted successfully");

    res.sendStatus(200);
  } catch (err) {
    console.error("Calendly webhook error", err);
    res.sendStatus(200);
  }
};
