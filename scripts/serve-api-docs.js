#!/usr/bin/env node

/**
 * Serve OpenAPI documentation using Swagger UI
 * Usage: node scripts/serve-api-docs.js [port]
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.argv[2] || 3000;

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../docs/api/openapi.yaml');
let swaggerDocument;

try {
  const yamlContent = fs.readFileSync(openApiPath, 'utf8');
  swaggerDocument = yaml.load(yamlContent);
  console.log('✅ Loaded OpenAPI specification from openapi.yaml');
} catch (error) {
  console.error('❌ Error loading OpenAPI specification:', error.message);
  process.exit(1);
}

// Swagger UI options
const options = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add any request modifications here
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #3b82f6; }
  `,
  customSiteTitle: 'VTT API Documentation'
};

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-docs-server',
    timestamp: new Date().toISOString()
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Start server
app.listen(port, () => {
  console.log(`🚀 VTT API Documentation server running on http://localhost:${port}`);
  console.log(`📖 API Documentation: http://localhost:${port}/api-docs`);
  console.log(`❤️  Health Check: http://localhost:${port}/health`);
  console.log('\n📋 Available endpoints documented:');
  console.log('   • Authentication (OAuth, JWT)');
  console.log('   • Health & Monitoring');
  console.log('   • Characters Management');
  console.log('   • Campaigns & Sessions');
  console.log('   • Monsters Database');
  console.log('   • AI Services (Tactical, Assistant)');
  console.log('   • Maps & Scenes');
  console.log('\n🛑 Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down API documentation server...');
  process.exit(0);
});
