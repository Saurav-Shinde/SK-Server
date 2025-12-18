import axios from 'axios'
import jwt from 'jsonwebtoken'

const BASE_URL = 'https://api.ristaapps.com/v1'

const createRistaToken = () => {
  const payload = {
    iss: process.env.RISTA_API_KEY,
    iat: Math.floor(Date.now() / 1000),
  }

  return jwt.sign(payload, process.env.RISTA_SECRET_KEY)
}

const ristaApi = axios.create({
  baseURL: BASE_URL,
})

ristaApi.interceptors.request.use((config) => {
  const token = createRistaToken()
  config.headers['x-api-key'] = process.env.RISTA_API_KEY
  config.headers['x-api-token'] = token
  return config
})

export const ristaClient = {
  async getOrders(outletId) {
    const res = await ristaApi.get(`/orders`, {
      params: { outlet_id: outletId },
    })
    return res.data.orders || []
  },

  async getInventory(outletId) {
    const res = await ristaApi.get(`/inventory`, {
      params: { outlet_id: outletId },
    })
    return res.data.items || []
  },
}
