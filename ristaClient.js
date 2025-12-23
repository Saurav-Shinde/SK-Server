import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const BASE_URL = "https://api.ristaapps.com/v1";

function createRistaToken() {
  return jwt.sign(
    {
      iss: process.env.RISTA_API_KEY,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(), // 🔐 important
    },
    process.env.RISTA_SECRET_KEY
  );
}

const ristaApi = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

ristaApi.interceptors.request.use((config) => {
  const token = createRistaToken();

  config.headers = {
    ...config.headers,
    "x-api-key": process.env.RISTA_API_KEY,
    "x-api-token": token,
    "content-type": "application/json",
  };

  return config;
});

// -----------------------------
// Helpers
// -----------------------------
function handleNotFound(err, fallback) {
  if (err?.response?.data?.code === "ResourceNotFound") {
    return fallback;
  }
  throw err;
}

// -----------------------------
// Client
// -----------------------------
export const ristaClient = {
  // ✅ Revenue + No of sales
  async getAnalyticsSummary({ branch, period }) {
    try {
      const res = await ristaApi.get("/analytics/sales/summary", {
        params: { branch, period },
      });
      return res.data || {};
    } catch (err) {
      return handleNotFound(err, {});
    }
  },

  // ✅ Sales page (for KPT)
  async getSalesPage({ branch, period, page = 1, size = 200 }) {
    try {
      const res = await ristaApi.get("/sales/page", {
        params: { branch, period, page, size },
      });

      // Rista returns paginated object
      return res.data?.data || [];
    } catch (err) {
      return handleNotFound(err, []);
    }
  },

  // ✅ Inventory
  async getInventory(store) {
    try {
      const res = await ristaApi.get("/inventory/store/items", {
        params: { store },
      });
      return res.data || [];
    } catch (err) {
      return handleNotFound(err, []);
    }
  },

  // ✅ Branch list
  async getOutlets() {
    const res = await ristaApi.get("/branch/list");
    return res.data || [];
  },
};
