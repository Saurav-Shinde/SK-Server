import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import eligibilityRoutes from './routes/eligibilityRoutes.js'
import productsRoute from './routes/productsRoute.js'
import mongoose from 'mongoose'
import dashboardRoutes from './routes/dashboard.routes.js'
import paymentRoutes from './routes/payment.js'
import adminBrandRoutes from './routes/admin.brand.routes.js'
import ristaHealthRoutes from './routes/rista.health.routes.js'
import analyticsRoutes from './routes/analytics.js'
import brandSettingsRoutes from "./routes/brand.settings.routes.js";
import brandProfileRoutes from "./routes/brand.profile.routes.js";

dotenv.config()
connectDB()

const app = express()

const rawOrigins = process.env.CLIENT_ORIGIN || 'http://localhost:3000'
const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean)

app.use((req, res, next) => {
  const origin = req.get('Origin')
  if (!origin) return next() // allow non-browser requests
  if (allowedOrigins.includes(origin)) {
    // echo back the exact origin (required when using credentials)
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    return next()
  }
  return res.status(403).json({ message: 'CORS Error: Origin not allowed' })
})


app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send('Server is running')
})

app.use('/api/auth', authRoutes)
app.use('/api/eligibility', eligibilityRoutes)
app.use('/api/products', productsRoute)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/admin', adminBrandRoutes)
app.use('/api/rista', ristaHealthRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use("/api/brand", brandSettingsRoutes);
app.use("/api/brand", brandProfileRoutes);
app.get("/debug/db", async (req, res) => {
  const dbName = mongoose.connection.db.databaseName;
  const collections = await mongoose.connection.db
    .listCollections()
    .toArray();

  res.json({
    database: dbName,
    collections: collections.map(c => c.name)
  });
});

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`)
})
