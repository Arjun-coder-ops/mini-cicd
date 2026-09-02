const mongoose = require('mongoose');
const { allowedRepos } = require('../config');

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^(HEAD|[a-fA-F0-9]{7,64})$/;

class ValidationError extends Error {}

const validateRepo = repo => {
  if (typeof repo !== 'string' || !REPO.test(repo)) throw new ValidationError('repo must use owner/repository format');
  if (!allowedRepos.includes(repo)) throw new ValidationError('repository is not in ALLOWED_REPOS');
  return repo;
};

const validateBranch = branch => {
  if (typeof branch !== 'string' || !branch || branch.length > 255 || branch.includes('..') || /[~^:?*\\\s\x00-\x1f]/.test(branch)) {
    throw new ValidationError('branch is invalid');
  }
  return branch;
};

const validateCommit = commit => {
  if (typeof commit !== 'string' || !SHA.test(commit)) throw new ValidationError('commit must be HEAD or a 7-64 character SHA');
  return commit;
};

const validateBuildId = id => {
  if (!mongoose.isValidObjectId(id)) throw new ValidationError('invalid build ID');
  return id;
};

const validatePagination = query => {
  const parse = (name, fallback, max) => {
    const value = query[name] === undefined ? fallback : Number(query[name]);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new ValidationError(`${name} must be an integer between 1 and ${max}`);
    return value;
  };
  return { page: parse('page', 1, 100000), limit: parse('limit', 20, 100) };
};

module.exports = { ValidationError, validateRepo, validateBranch, validateCommit, validateBuildId, validatePagination };
