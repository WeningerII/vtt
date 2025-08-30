import { chromium, FullConfig } from '@playwright/test';
import { testDb } from './utils/database';
import { join } from 'path';
import dotenv from 'dotenv';

async function globalSetup(_config: FullConfig) {
  console.log('[E2E Setup] Starting comprehensive test environment...');
  
  // Load test environment variables
  dotenv.config({ path: join(process.cwd(), '.env.test') });
  
  // Setup test database
  const skipDb = !!process.env.E2E_SKIP_DB || !!process.env.E2E_SKIP_DB_SETUP;
  if (skipDb) {
    console.log('[E2E Setup] Skipping DB setup/seed (E2E_SKIP_DB)');
  } else {
    await testDb.setup();
    await testDb.seed();
  }
  
  // Wait for services to be ready (webServer handles startup)
  console.log('[E2E Setup] Waiting for services to be ready...');
  
  // Health check with retry logic
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let serverReady = false;
  const skipClient = !!process.env.E2E_SKIP_CLIENT;
  let clientReady = skipClient; // if skipping client, treat as ready
  const maxRetries = 30;
  const retryDelay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check server health
      if (!serverReady) {
        const serverResponse = await page.request.get('http://localhost:8080/livez');
        if (serverResponse.ok()) {
          console.log('[E2E Setup] Server is ready');
          serverReady = true;
        }
      }
      
      // Check client health (optional)
      if (!clientReady && !skipClient) {
        const clientResponse = await page.goto('http://localhost:3000', {
          waitUntil: 'networkidle',
          timeout: 5000,
        });
        if (clientResponse?.ok()) {
          console.log('[E2E Setup] Client is ready');
          clientReady = true;
        }
      }
      
      if (serverReady && clientReady) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('[E2E Setup] Services failed to start:', error);
        throw new Error('Test environment setup failed - services not ready');
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  await browser.close();
  
  if (!serverReady || (!clientReady && !skipClient)) {
    throw new Error('Test environment setup failed - services not ready after maximum retries');
  }
  
  console.log('[E2E Setup] All services ready - test environment initialized');
}

export default globalSetup;
