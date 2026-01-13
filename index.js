import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import connectDB from './config/db.js'
import authRoutes from './routes/auth.routes.js'
import eligibilityRoutes from './routes/eligibility.routes.js'
import productsRoute from './routes/products.routes.js'
import mongoose from 'mongoose'
import dashboardRoutes from './routes/dashboard.routes.js'
import paymentRoutes from './routes/payment.routes.js'
import adminBrandRoutes from './routes/admin.brand.routes.js'
import ristaHealthRoutes from './routes/rista.health.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'
import brandSettingsRoutes from "./routes/brand.settings.routes.js";
import brandProfileRoutes from "./routes/brand.profile.routes.js";
import meetingRoutes from './routes/meeting.routes.js'
import stockRoutes from "./routes/stock.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import creditsRoutes from "./routes/credits.routes.js";



dotenv.config()
connectDB()

const app = express()

const rawOrigins =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://sk-peach-two.vercel.app";

const allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: [
      "https://sk-peach-two.vercel.app",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,Accept,X-Requested-With"
  })
);

// explicitly handle preflight
app.options("*", cors());







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
app.use('/api/meeting', meetingRoutes)
app.use("/api", stockRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/credits", creditsRoutes);

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
