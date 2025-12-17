// ristaClient.js
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const {
  RISTA_API_KEY,
  RISTA_SECRET_KEY,
  RISTA_BASE_URL
} = process.env;

if (!RISTA_API_KEY || !RISTA_SECRET_KEY) {
  throw new Error("Rista API Key or Secret missing in env");
}

// 🔐 Generate JWT (NEW token per request)
function generateJwtToken() {
  const payload = {
    iss: RISTA_API_KEY,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, RISTA_SECRET_KEY);
}

// 🚀 Axios instance
export async function ristaRequest(method, endpoint, data = null, params = null) {
  const token = generateJwtToken();

  return axios({
    method,
    url: `${RISTA_BASE_URL}${endpoint}`,
    headers: {
      "x-api-key": RISTA_API_KEY,
      "x-api-token": token,
      "Content-Type": "application/json"
    },
    data,
    params
  });
}
