const path = require('node:path');
function loadConfig(env = process.env, projectRoot = path.resolve(__dirname, '..')) {
  if (!/^[a-f0-9]{64}$/i.test(env.ARCHIVE_KEY || ''))
    throw Object.assign(new Error('Invalid archive encryption key'), {
      code: 'INVALID_ARCHIVE_KEY',
    });
  const dataRoot = path.resolve(env.DATA_DIR || path.join(projectRoot, 'data'));
  const archiveRoot = path.join(projectRoot, 'archive');
  return {
    projectRoot,
    dataRoot,
    archiveRoot,
    spoolRoot: path.join(dataRoot, 'spool'),
    cacheRoot: path.join(dataRoot, 'cache'),
    databasePath: path.join(dataRoot, 'catalog.sqlite'),
    key: env.ARCHIVE_KEY,
    setupToken: env.SETUP_TOKEN,
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || 3080),
    localReserveBytes: 256 * 1024 * 1024,
    maxImageBytes: 20 * 1024 * 1024,
    cacheBytes: 128 * 1024 * 1024,
  };
}
module.exports = { loadConfig };
