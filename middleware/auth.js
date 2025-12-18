import jwt from 'jsonwebtoken'

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' })
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return res.status(401).json({ message: 'Token missing' })
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'development-secret'
    )

    req.user = decoded // { userId, brandName }
    next()
  } catch (err) {
    console.error('Auth error:', err.message)
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
