import {
  getAuthenticatedCalendarClient,
  hasStoredRefreshToken,
} from "../services/googleTokenManager.js";
import CalendarSync from "../models/calendarSync.model.js";

/**
 * GET /api/google/debug
 * Self-diagnostics for Google Calendar OAuth + watch + webhook.
 */
export const getGoogleDebug = async (req, res) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const oauthConfigured = !!(clientId && clientSecret && redirectUri);

  let refreshTokenStored = false;
  try {
    refreshTokenStored = await hasStoredRefreshToken();
  } catch {}

  let accessTokenValid = false;
  try {
    const client = await getAuthenticatedCalendarClient();
    accessTokenValid = !!client;
  } catch {}

  let calendarAccessible = false;
  try {
    const client = await getAuthenticatedCalendarClient();
    if (client && process.env.GOOGLE_CALENDAR_ID) {
      await client.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        maxResults: 1,
      });
      calendarAccessible = true;
    }
  } catch {}

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const syncDoc = calendarId
    ? await CalendarSync.findOne({ calendarId }).lean()
    : null;

  const watchActive = !!(syncDoc?.channelId && syncDoc?.resourceId);
  const webhookUrl = process.env.GOOGLE_WEBHOOK_ADDRESS;
  const webhookReachable = !!(
    webhookUrl &&
    (webhookUrl.startsWith("https://") || webhookUrl.startsWith("http://"))
  );

  res.json({
    oauthConfigured,
    refreshTokenStored,
    accessTokenValid,
    calendarAccessible,
    watchActive,
    webhookReachable,
    lastEventFetched: syncDoc?.lastEventFetched ?? null,
    lastWebhookReceived: syncDoc?.lastWebhookReceived ?? null,
    lastError: syncDoc?.lastError ?? null,
  });
};
