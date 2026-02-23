import mongoose from "mongoose";

const calendarSyncSchema = new mongoose.Schema(
  {
    calendarId: { type: String, required: true, unique: true },
    nextSyncToken: { type: String, default: null },
    channelId: { type: String, default: null },
    resourceId: { type: String, default: null },
    channelExpiration: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
    // Debug / diagnostics
    lastEventFetched: { type: Date, default: null },
    lastWebhookReceived: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("CalendarSync", calendarSyncSchema);
