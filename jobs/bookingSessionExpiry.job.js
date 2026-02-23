import cron from "node-cron";
import BookingSession from "../models/bookingSession.model.js";

/**
 * Marks expired HOLD sessions as EXPIRED every minute.
 * (Wallet is not changed because HOLD never deducts.)
 *
 * NOTE: TTL index will later delete expired docs automatically;
 * this job provides clearer state for debugging/confirm endpoint behavior.
 */
export const startBookingSessionExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      await BookingSession.updateMany(
        { status: "HOLD", expiresAt: { $lt: now } },
        { $set: { status: "EXPIRED" } }
      );
    } catch (err) {
      console.error("BookingSession expiry cron error:", err?.message || err);
    }
  });
};

