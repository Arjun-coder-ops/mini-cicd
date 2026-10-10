const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, config.refreshTokenSecret, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const setRefreshTokenCookie = (res, token) => {
  const isHttps = process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');
  const sameSite = process.env.COOKIE_SAME_SITE || (isHttps ? 'none' : 'lax');
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTERED',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.status(201).json({ accessToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGGED_IN',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ accessToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, config.refreshTokenSecret);
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid user' });
    }

    const tokens = generateTokens(user._id);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  res.clearCookie('refreshToken');
  
  await AuditLog.create({
    userId: req.user._id,
    action: 'USER_LOGGED_OUT',
    resourceType: 'USER',
    resourceId: req.user._id.toString(),
    ipAddress: req.ip,
  });

  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: { id: req.user._id, email: req.user.email, name: req.user.name, role: req.user.role } });
});

module.exports = router;
