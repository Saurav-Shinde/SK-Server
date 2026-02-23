import { v4 as uuid } from "uuid";
import cron from "node-cron";
import CalendarSync from "../models/calendarSync.model.js";
import { getAuthenticatedCalendarClient } from "./googleTokenManager.js";

const SIX_DAYS_CRON = "0 0 */6 * *";

const getSyncDoc = async () => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID is missing");
  return CalendarSync.findOneAndUpdate(
    { calendarId },
    { $setOnInsert: { calendarId } },
    { upsert: true, new: true }
  );
};

const saveSyncDoc = async (syncDoc, patch) => {
  Object.assign(syncDoc, patch, { updatedAt: new Date() });
  await syncDoc.save();
};

const recordError = async (err) => {
  try {
    const syncDoc = await getSyncDoc();
    await saveSyncDoc(syncDoc, { lastError: String(err?.message || err) });
  } catch {}
};

const recordEventFetched = async () => {
  try {
    const syncDoc = await getSyncDoc();
    await saveSyncDoc(syncDoc, { lastEventFetched: new Date(), lastError: null });
  } catch {}
};

/**
 * Validates webhook is from our active channel. If we have a stored resourceId, require match.
 */
export const validateWebhookChannel = async (req) => {
  try {
    const syncDoc = await getSyncDoc();
    const incomingResourceId = req.headers["x-goog-resource-id"];
    if (!syncDoc?.resourceId) return true;
    if (!incomingResourceId) return false;
    return syncDoc.resourceId === incomingResourceId;
  } catch {
    return true;
  }
};

export const recordWebhookReceived = async () => {
  try {
    const syncDoc = await getSyncDoc();
    await saveSyncDoc(syncDoc, { lastWebhookReceived: new Date() });
  } catch {}
};

const runFullSync = async (calendar) => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const res = await calendar.events.list({
    calendarId,
    singleEvents: true,
    showDeleted: true,
  });
  return {
    events: res.data?.items || [],
    nextSyncToken: res.data?.nextSyncToken || null,
  };
};

export const initializeCalendarSync = async () => {
  let calendar;
  try {
    calendar = await getAuthenticatedCalendarClient();
  } catch (err) {
    await recordError(err);
    return { enabled: false, reason: "OAuth token missing or invalid" };
  }
  if (!calendar) return { enabled: false, reason: "No refresh token stored" };

  const syncDoc = await getSyncDoc();
  if (syncDoc.nextSyncToken) return { enabled: true, initialized: false };

  const { nextSyncToken } = await runFullSync(calendar);
  await saveSyncDoc(syncDoc, { nextSyncToken });
  await recordEventFetched();
  return { enabled: true, initialized: true };
};

export const stopCalendarWatch = async () => {
  let calendar;
  try {
    calendar = await getAuthenticatedCalendarClient();
  } catch {
    return { enabled: false, reason: "OAuth token missing" };
  }
  if (!calendar) return { enabled: false, reason: "No refresh token" };

  const syncDoc = await getSyncDoc();
  if (!syncDoc.channelId || !syncDoc.resourceId) return { enabled: true, stopped: false };

  try {
    await calendar.channels.stop({
      requestBody: { id: syncDoc.channelId, resourceId: syncDoc.resourceId },
    });
  } catch (err) {
    console.warn("[GoogleError] Channel stop:", err?.message || err);
  }

  await saveSyncDoc(syncDoc, { channelId: null, resourceId: null, channelExpiration: null });
  return { enabled: true, stopped: true };
};

export const watchCalendar = async () => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const address = process.env.GOOGLE_WEBHOOK_ADDRESS;
  const webhookToken = process.env.GOOGLE_WEBHOOK_TOKEN;

  if (!calendarId || !address) return { enabled: false, reason: "GOOGLE_CALENDAR_ID or GOOGLE_WEBHOOK_ADDRESS missing" };

  let calendar;
  try {
    calendar = await getAuthenticatedCalendarClient();
  } catch (err) {
    await recordError(err);
    return { enabled: false, reason: "OAuth token missing or invalid" };
  }
  if (!calendar) return { enabled: false, reason: "No refresh token stored" };

  await stopCalendarWatch();

  const syncDoc = await getSyncDoc();
  const channelId = uuid();

  const doWatch = async (cal) => {
    return cal.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address,
        ...(webhookToken ? { token: webhookToken } : {}),
      },
    });
  };

  try {
    let watchRes = await doWatch(calendar);
    await saveSyncDoc(syncDoc, {
      channelId,
      resourceId: watchRes.data?.resourceId || null,
      channelExpiration: watchRes.data?.expiration ? new Date(Number(watchRes.data.expiration)) : null,
    });
    console.log("[GoogleWatch] Started");
    return { enabled: true, channelId, resourceId: watchRes.data?.resourceId || null };
  } catch (err) {
    const status = err?.code ?? err?.response?.status;
    if (status === 401 || status === 404) {
      console.warn("[GoogleError] Watch 401/404, retrying with fresh token");
      try {
        const freshCalendar = await getAuthenticatedCalendarClient();
        if (freshCalendar) {
          const watchRes = await doWatch(freshCalendar);
          await saveSyncDoc(syncDoc, {
            channelId,
            resourceId: watchRes.data?.resourceId || null,
            channelExpiration: watchRes.data?.expiration ? new Date(Number(watchRes.data.expiration)) : null,
          });
          console.log("[GoogleWatch] Started (after retry)");
          return { enabled: true, channelId, resourceId: watchRes.data?.resourceId || null };
        }
      } catch (retryErr) {
        await recordError(retryErr);
        throw retryErr;
      }
    }
    await recordError(err);
    throw err;
  }
};

export const listIncrementalCalendarEvents = async () => {
  let calendar;
  try {
    calendar = await getAuthenticatedCalendarClient();
  } catch (err) {
    await recordError(err);
    return { events: [], refreshed: false };
  }
  if (!calendar) return { events: [], refreshed: false };

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const syncDoc = await getSyncDoc();

  if (!syncDoc.nextSyncToken) {
    const full = await runFullSync(calendar);
    await saveSyncDoc(syncDoc, { nextSyncToken: full.nextSyncToken });
    await recordEventFetched();
    return { events: full.events, refreshed: true };
  }

  try {
    const res = await calendar.events.list({
      calendarId,
      syncToken: syncDoc.nextSyncToken,
      showDeleted: true,
      singleEvents: true,
    });

    await saveSyncDoc(syncDoc, { nextSyncToken: res.data?.nextSyncToken || syncDoc.nextSyncToken });
    await recordEventFetched();
    return { events: res.data?.items || [], refreshed: false };
  } catch (err) {
    const status = err?.code ?? err?.response?.status;
    if (status === 410) {
      const full = await runFullSync(calendar);
      await saveSyncDoc(syncDoc, { nextSyncToken: full.nextSyncToken });
      await recordEventFetched();
      return { events: full.events, refreshed: true };
    }
    await recordError(err);
    if (status === 401 || status === 404) {
      console.warn("[GoogleError] List 401/404, token may need refresh:", status);
    }
    throw err;
  }
};

export const startCalendarWatchRenewalScheduler = () => {
  cron.schedule(SIX_DAYS_CRON, async () => {
    try {
      await watchCalendar();
      console.log("[GoogleWatch] Renewed");
    } catch (err) {
      console.error("[GoogleError]", err?.message || err);
    }
  });
  
};

export async function startGoogleWatch(force = false) {
  try {
    const calendar = await getAuthenticatedCalendarClient();

    // stop old channel if force
    if (force) {
      console.log("[GoogleWatch] Restart requested");
    }

    const channelId = "primary-channel";
    const address = process.env.GOOGLE_WEBHOOK_ADDRESS;

    const res = await calendar.events.watch({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: address,
        token: process.env.GOOGLE_WEBHOOK_TOKEN,
      },
    });

    console.log("[GoogleWatch] Started", res.data?.resourceId);
    return res.data;
  } catch (err) {
    console.error("[GoogleWatch] Failed:", err.message);
    throw err;
  }
}