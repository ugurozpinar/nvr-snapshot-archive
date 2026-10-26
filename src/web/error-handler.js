module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const code = err.code || 'INTERNAL_ERROR';
  const status =
    err.status ||
    (['NAS_UNAVAILABLE', 'NAS_BUSY', 'NAS_REQUIRED', 'NAS_SPACE_LOW'].includes(code)
      ? 503
      : [
            'AUTH_FAILED',
            'NVR_UNREACHABLE',
            'NVR_HTTP_ERROR',
            'INVALID_IMAGE',
            'IMAGE_TOO_LARGE',
          ].includes(code)
        ? 502
        : code === 'CAPTURE_TIMEOUT'
          ? 504
          : code.startsWith('SQLITE_CONSTRAINT')
            ? 409
            : code === 'ENOENT'
              ? 404
              : [
                    'INVALID_MASK',
                    'NAS_WRONG_MOUNT',
                    'NAS_WRONG_DEPOT',
                    'NAS_SYMLINK',
                    'NAS_CONFIG_REQUIRED',
                    'NAS_REQUIRES_LINUX',
                  ].includes(code)
                ? 400
                : 500);
  res.status(status).json({ error: status === 500 ? 'INTERNAL_ERROR' : code });
};
