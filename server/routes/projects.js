const express = require('express');
const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireProjectRole } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();
router.use(requireAuth);

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const memberships = await ProjectMember.find({ userId: req.user._id }).populate('projectId');
    const projects = memberships.map(m => m.projectId);
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, repository, defaultBranch = 'main', visibility = 'private' } = req.body;
    
    // basic slug generation
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Project.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const project = await Project.create([{
      name, slug, ownerId: req.user._id, repository, defaultBranch, visibility
    }], { session });

    await ProjectMember.create([{
      projectId: project[0]._id,
      userId: req.user._id,
      role: 'OWNER'
    }], { session });

    await AuditLog.create([{
      projectId: project[0]._id,
      userId: req.user._id,
      action: 'PROJECT_CREATED',
      resourceType: 'PROJECT',
      resourceId: project[0]._id.toString(),
      ipAddress: req.ip,
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ project: project[0] });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:projectId
router.patch('/:projectId', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.repository) updates.repository = req.body.repository;
    if (req.body.defaultBranch) updates.defaultBranch = req.body.defaultBranch;
    if (req.body.visibility) updates.visibility = req.body.visibility;
    if (req.body.pipelineConfig) updates.pipelineConfig = req.body.pipelineConfig;

    const project = await Project.findByIdAndUpdate(req.params.projectId, updates, { new: true });
    
    await AuditLog.create({
      projectId: project._id,
      userId: req.user._id,
      action: 'PROJECT_UPDATED',
      resourceType: 'PROJECT',
      resourceId: project._id.toString(),
      ipAddress: req.ip,
    });

    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', requireProjectRole(['OWNER']), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    await Project.findByIdAndDelete(projectId);
    await ProjectMember.deleteMany({ projectId });
    // Cleanup builds, secrets, etc. would go here in a real scenario
    
    await AuditLog.create({
      projectId,
      userId: req.user._id,
      action: 'PROJECT_DELETED',
      resourceType: 'PROJECT',
      resourceId: projectId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET members
router.get('/:projectId/members', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  try {
    const members = await ProjectMember.find({ projectId: req.params.projectId }).populate('userId', 'name email role');
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST member
router.post('/:projectId/members', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { email, role } = req.body;
    // We would resolve email to user
    const User = require('../models/User');
    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (!['ADMIN', 'DEVELOPER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const member = await ProjectMember.create({
      projectId: req.params.projectId,
      userId: targetUser._id,
      role
    });

    await AuditLog.create({
      projectId: req.params.projectId,
      userId: req.user._id,
      action: 'MEMBER_ADDED',
      resourceType: 'PROJECT_MEMBER',
      resourceId: member._id.toString(),
      metadata: { targetUserId: targetUser._id, role },
      ipAddress: req.ip,
    });

    res.status(201).json({ member });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'User already a member' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH member
router.patch('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'DEVELOPER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Don't allow changing owner role or an admin changing owner's role
    const targetMember = await ProjectMember.findOne({ projectId: req.params.projectId, userId: req.params.userId });
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });
    if (targetMember.role === 'OWNER') return res.status(403).json({ error: 'Cannot change OWNER role' });

    targetMember.role = role;
    await targetMember.save();

    await AuditLog.create({
      projectId: req.params.projectId,
      userId: req.user._id,
      action: 'MEMBER_ROLE_CHANGED',
      resourceType: 'PROJECT_MEMBER',
      resourceId: targetMember._id.toString(),
      metadata: { targetUserId: req.params.userId, newRole: role },
      ipAddress: req.ip,
    });

    res.json({ member: targetMember });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE member
router.delete('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const targetMember = await ProjectMember.findOne({ projectId: req.params.projectId, userId: req.params.userId });
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });
    if (targetMember.role === 'OWNER') return res.status(403).json({ error: 'Cannot remove OWNER' });

    await targetMember.deleteOne();

    await AuditLog.create({
      projectId: req.params.projectId,
      userId: req.user._id,
      action: 'MEMBER_REMOVED',
      resourceType: 'PROJECT_MEMBER',
      resourceId: targetMember._id.toString(),
      metadata: { targetUserId: req.params.userId },
      ipAddress: req.ip,
    });

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// API Keys
router.get('/:projectId/keys', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const keys = await require('../models/ApiKey').find({ projectId: req.params.projectId, revokedAt: null });
    res.json({ keys });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:projectId/keys', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { name, scopes } = req.body;
    const crypto = require('crypto');
    const rawKey = 'sk_' + req.params.projectId + '_' + crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.split('_').slice(0,2).join('_');
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    const key = await require('../models/ApiKey').create({
      projectId: req.params.projectId,
      name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: scopes || [],
      createdBy: req.user._id,
    });
    
    await AuditLog.create({
      projectId: req.params.projectId, userId: req.user._id, action: 'API_KEY_CREATED', resourceType: 'API_KEY', resourceId: key._id.toString(), ipAddress: req.ip
    });
    
    res.status(201).json({ key, rawKey });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:projectId/keys/:keyId', requireProjectRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const key = await require('../models/ApiKey').findOneAndUpdate(
      { _id: req.params.keyId, projectId: req.params.projectId },
      { revokedAt: new Date() },
      { new: true }
    );
    if (!key) return res.status(404).json({ error: 'Key not found' });
    
    await AuditLog.create({
      projectId: req.params.projectId, userId: req.user._id, action: 'API_KEY_REVOKED', resourceType: 'API_KEY', resourceId: key._id.toString(), ipAddress: req.ip
    });
    
    res.json({ message: 'Key revoked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

