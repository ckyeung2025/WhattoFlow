const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

// Read .NET port from appsettings.json (same as read-port-from-config.js does)
function getDotNetPort() {
  try {
    // Look for appsettings.json in project root or current directory
    let configPath = path.join(__dirname, '..', 'appsettings.json');
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'appsettings.json');
    }
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.Ports?.DotNet || 64213;
    }
  } catch (error) {
    console.error('Error reading appsettings.json for proxy:', error.message);
  }
  return 64213; // Default port
}

const dotNetPort = getDotNetPort();
const proxyTarget = `http://localhost:${dotNetPort}`;

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: proxyTarget,
      changeOrigin: true,
    })
  );
  app.use(
    '/Customer',
    createProxyMiddleware({
      target: proxyTarget,
      changeOrigin: true,
    })
  );
}; 