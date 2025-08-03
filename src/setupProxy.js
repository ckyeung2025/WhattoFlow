const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:64213',
      changeOrigin: true,
    })
  );
  app.use(
    '/Customer',
    createProxyMiddleware({
      target: 'http://localhost:64213',
      changeOrigin: true,
    })
  );
}; 