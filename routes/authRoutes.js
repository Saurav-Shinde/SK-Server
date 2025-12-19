import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/user.js'

const router = express.Router()

const createToken = (user) => {
  const secret = process.env.JWT_SECRET || 'development-secret'

  return jwt.sign(
    {
      userId: user._id,
      brandName: user.brandName,
    },
    secret,
    { expiresIn: '7d' }
  )
}



const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  brandName: user.brandName,
  email: user.email,
  address: user.address,
})

router.post('/signup', async (req, res) => {
  try {
    const { name, brandName, email, password, address } = req.body

    if (!name || !brandName || !email || !password || !address) {
      return res.status(400).json({ message: 'All fields are required.' })
    }

    const normalizedEmail = email.toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      name,
      brandName,
      email: normalizedEmail,
      password: hashedPassword,
      address,
    })

    const token = createToken(user)
    res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Unable to create account. Please try again.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const token = createToken(user)
    res.json({ token, user: sanitizeUser(user) })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Unable to login. Please try again.' })
  }
})

export default router

