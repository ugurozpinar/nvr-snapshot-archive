const express = require('express');
const path = require('node:path');
const { createAuth } = require('../security/auth');
const { range, cleanImage } = require('./validation');
const errorHandler = require('./error-handler');
const routes = ['status', 'settings', 'nvrs', 'cameras', 'archive'].map((name) =>
  require('./routes/' + name),
);

function createWebServer(deps) {
  const app = express();
  const auth = createAuth(deps);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/session', (req, res) => res.json(auth.info(req)));
  app.post('/api/setup', auth.setup);
  app.post('/api/login', auth.login);
  app.use('/api', auth.require);
  app.post('/api/logout', auth.logout);
  for (const route of routes) route.register(app, deps);
  app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(express.static(path.join(deps.config.projectRoot, 'public')));
  app.use((req, res) =>
    res.status(404).sendFile(path.join(deps.config.projectRoot, 'public/404.html')),
  );
  app.use(errorHandler);
  return app;
}

module.exports = { createWebServer, range, cleanImage };
