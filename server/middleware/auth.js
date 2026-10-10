const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const ProjectMember = require('../models/ProjectMember');
const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');

const { tokensMatch } = require('../utils/auth');

const requireAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check system master token
    if (config.apiToken && tokensMatch(token, config.apiToken)) {
      req.user = { _id: 'system', name: 'System', role: 'ADMIN' };
      return next();
    }

    // Check if it's an API Key (starts with prefix followed by _)
    // Format: sk_projectId_randomString
    if (token.startsWith('sk_')) {
      const parts = token.split('_');
      if (parts.length === 3) {
        const prefix = parts[0] + '_' + parts[1];
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const apiKey = await ApiKey.findOne({ keyPrefix: prefix, keyHash: hash });
        
        if (!apiKey) return res.status(401).json({ error: 'Invalid API key' });
        if (apiKey.revokedAt) return res.status(401).json({ error: 'API key revoked' });
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return res.status(401).json({ error: 'API key expired' });

        apiKey.lastUsedAt = new Date();
        await apiKey.save();

        req.apiKey = apiKey;
        req.user = await User.findById(apiKey.createdBy);
        return next();
      }
    }

    // Otherwise treat as JWT
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireProjectRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // System admin token bypasses project membership check
      if (req.user && req.user._id === 'system') {
        return next();
      }

      let projectId = req.params.projectId || req.query.projectId || req.body.projectId;
      if (!projectId && req.params.id) {
        if (req.baseUrl && req.baseUrl.includes('/builds')) {
          const mongoose = require('mongoose');
          if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid build ID' });
          }
          const Build = require('../models/Build');
          const b = await Build.findById(req.params.id);
          if (b && b.projectId) projectId = b.projectId.toString();
        } else {
          projectId = req.params.id;
        }
      }

      if (!projectId) return res.status(400).json({ error: 'Project ID required' });

      // If using API key, verify scope/project
      if (req.apiKey) {
        if (req.apiKey.projectId.toString() !== projectId.toString()) {
          return res.status(403).json({ error: 'API key not valid for this project' });
        }
        return next();
      }

      const membership = await ProjectMember.findOne({
        projectId,
        userId: req.user._id,
      });

      if (!membership) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (allowedRoles && !allowedRoles.includes(membership.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.projectRole = membership.role;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = { requireAuth, requireProjectRole };
