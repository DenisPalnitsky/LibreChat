const rateLimit = require('express-rate-limit');
const { ViolationTypes } = require('librechat-data-provider');
const logViolation = require('~/cache/logViolation');

const getEnvironmentVariables = () => {
  const IMPORT_IP_MAX = parseInt(process.env.IMPORT_IP_MAX) || 100;
  const IMPORT_IP_WINDOW = parseInt(process.env.IMPORT_IP_WINDOW) || 15;
  const IMPORT_USER_MAX = parseInt(process.env.IMPORT_USER_MAX) || 50;
  const IMPORT_USER_WINDOW = parseInt(process.env.IMPORT_USER_WINDOW) || 15;

  const importIpWindowMs = IMPORT_IP_WINDOW * 60 * 1000;
  const importIpMax = IMPORT_IP_MAX;
  const importIpWindowInMinutes = importIpWindowMs / 60000;

  const importUserWindowMs = IMPORT_USER_WINDOW * 60 * 1000;
  const importUserMax = IMPORT_USER_MAX;
  const importUserWindowInMinutes = importUserWindowMs / 60000;

  return {
    importIpWindowMs,
    importIpMax,
    importIpWindowInMinutes,
    importUserWindowMs,
    importUserMax,
    importUserWindowInMinutes,
  };
};

const createImportHandler = (ip = true) => {
  const { importIpMax, importIpWindowInMinutes, importUserMax, importUserWindowInMinutes } =
    getEnvironmentVariables();

  return async (req, res) => {
    const type = ViolationTypes.FILE_UPLOAD_LIMIT;
    const errorMessage = {
      type,
      max: ip ? importIpMax : importUserMax,
      limiter: ip ? 'ip' : 'user',
      windowInMinutes: ip ? importIpWindowInMinutes : importUserWindowInMinutes,
    };

    await logViolation(req, res, type, errorMessage);
    res.status(429).json({ message: 'Too many file upload requests. Try again later' });
  };
};

const createImportLimiters = () => {
  const { importIpWindowMs, importIpMax, importUserWindowMs, importUserMax } =
    getEnvironmentVariables();

  const importIpLimiter = rateLimit({
    windowMs: importIpWindowMs,
    max: importIpMax,
    handler: createImportHandler(),
  });

  const importUserLimiter = rateLimit({
    windowMs: importUserWindowMs,
    max: importUserMax,
    handler: createImportHandler(false),
    keyGenerator: function (req) {
      return req.user?.id; // Use the user ID or NULL if not available
    },
  });

  return { importIpLimiter, importUserLimiter };
};

module.exports = { createImportLimiters };
