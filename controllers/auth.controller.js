import User from '../models/user.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

/* ---------------- TOKEN CREATION ---------------- */

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

/* ---------------- SANITIZE USER ---------------- */

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  brandName: user.brandName,
  email: user.email,
  address: user.address,
})

/* ---------------- SIGNUP ---------------- */

export const signup = async (req, res) => {
  try {
    const { name, brandName, email, password, address } = req.body

    if (!name || !brandName || !email || !password || !address) {
      return res.status(400).json({ message: 'All fields are required.' })
    }

    const normalizedEmail = email.toLowerCase()

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      })
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

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    })
  } catch (error) {
    console.error('Signup error:', error)
    res
      .status(500)
      .json({ message: 'Unable to create account. Please try again.' })
  }
}

/* ---------------- GET USER CREDITS ---------------- */

export const getCredits = async (req, res) => {
  try {
    const userId = req.user?.userId // set by authMiddleware

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Only fetch what we need
    const user = await User.findById(userId).select('credits name email')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      success: true,
      credits: user.credits || 0,
      name: user.name,
      email: user.email,
    })
  } catch (err) {
    console.error('Credits fetch error:', err)
    return res
      .status(500)
      .json({ message: 'Unable to fetch credits, please try again later.' })
  }
}
