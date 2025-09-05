#!/usr/bin/env node

/**
 * Test script for critical VTT application features
 * Verifies that core functionality is working after fixes
 */

const fs = require('fs');
const path = require('path');

const testResults = [];

function logTest(feature, status, details) {
  const result = {
    feature,
    status,
    details,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  console.log(`[${status}] ${feature}: ${details}`);
}

// Test 1: WebSocket configuration
function testWebSocketConfig() {
  const wsHookPath = path.join(__dirname, '../apps/client/src/hooks/useWebSocket.ts');
  try {
    const content = fs.readFileSync(wsHookPath, 'utf8');
    
    // Check for dynamic URL configuration
    if (content.includes('window.location.protocol') && 
        content.includes('process.env.REACT_APP_WS_URL')) {
      logTest('WebSocket Configuration', 'PASS', 'Dynamic URL configuration found');
    } else if (content.includes('localhost:3001')) {
      logTest('WebSocket Configuration', 'FAIL', 'Still using hardcoded localhost');
    } else {
      logTest('WebSocket Configuration', 'PASS', 'No hardcoded localhost found');
    }
  } catch (error) {
    logTest('WebSocket Configuration', 'ERROR', error.message);
  }
}

// Test 2: Environment configuration
function testEnvironmentConfig() {
  const envProdPath = path.join(__dirname, '../apps/client/.env.production');
  const envExamplePath = path.join(__dirname, '../apps/client/.env.example');
  
  try {
    if (fs.existsSync(envProdPath)) {
      const content = fs.readFileSync(envProdPath, 'utf8');
      const requiredVars = ['REACT_APP_API_URL', 'REACT_APP_WS_URL'];
      const missingVars = requiredVars.filter(v => !content.includes(v));
      
      if (missingVars.length === 0) {
        logTest('Environment Configuration', 'PASS', 'All required variables present');
      } else {
        logTest('Environment Configuration', 'WARN', `Missing: ${missingVars.join(', ')}`);
      }
    } else {
      logTest('Environment Configuration', 'WARN', 'Production env file not found');
    }
  } catch (error) {
    logTest('Environment Configuration', 'ERROR', error.message);
  }
}

// Test 3: Authentication handlers
function testAuthHandlers() {
  const loginFormPath = path.join(__dirname, '../apps/client/src/components/auth/LoginForm.tsx');
  
  try {
    const content = fs.readFileSync(loginFormPath, 'utf8');
    
    // Check for proper onClick handlers
    const hasPasswordToggle = content.includes('setShowPassword(!showPassword)');
    const hasNavigation = content.includes("navigate('/auth/forgot-password')") || 
                          content.includes("navigate('/auth/register')");
    
    if (hasPasswordToggle && hasNavigation) {
      logTest('Authentication Handlers', 'PASS', 'All UI handlers properly configured');
    } else {
      const issues = [];
      if (!hasPasswordToggle) issues.push('password toggle');
      if (!hasNavigation) issues.push('navigation');
      logTest('Authentication Handlers', 'FAIL', `Missing: ${issues.join(', ')}`);
    }
  } catch (error) {
    logTest('Authentication Handlers', 'ERROR', error.message);
  }
}

// Test 4: Campaign management
function testCampaignManagement() {
  const campaignPath = path.join(__dirname, '../apps/client/src/components/campaigns/CampaignMapManager.tsx');
  
  try {
    const content = fs.readFileSync(campaignPath, 'utf8');
    
    // Check for modal state handlers
    const hasModalStates = content.includes('showCreateModal') && 
                          content.includes('showSettingsModal') &&
                          content.includes('showPlayersModal');
    
    // Check for scene handlers
    const hasSceneHandlers = content.includes('handleDuplicateScene') &&
                            content.includes('handleDeleteScene') &&
                            content.includes('handleSceneSettings');
    
    if (hasModalStates && hasSceneHandlers) {
      logTest('Campaign Management', 'PASS', 'All handlers and state management present');
    } else {
      const issues = [];
      if (!hasModalStates) issues.push('modal states');
      if (!hasSceneHandlers) issues.push('scene handlers');
      logTest('Campaign Management', 'FAIL', `Missing: ${issues.join(', ')}`);
    }
  } catch (error) {
    logTest('Campaign Management', 'ERROR', error.message);
  }
}

// Test 5: API endpoint configuration
function testAPIEndpoints() {
  const authProviderPath = path.join(__dirname, '../apps/client/src/providers/AuthProvider.tsx');
  
  try {
    const content = fs.readFileSync(authProviderPath, 'utf8');
    
    // Check for environment variable usage
    const usesEnvVar = content.includes('process.env.REACT_APP_API_URL');
    const hasOptionalServerUrl = content.includes('serverUrl?:');
    
    if (usesEnvVar && hasOptionalServerUrl) {
      logTest('API Configuration', 'PASS', 'Using environment variables for API URLs');
    } else {
      logTest('API Configuration', 'WARN', 'May not be using environment variables properly');
    }
  } catch (error) {
    logTest('API Configuration', 'ERROR', error.message);
  }
}

// Run all tests
console.log('=== VTT Critical Features Test ===\n');

testWebSocketConfig();
testEnvironmentConfig();
testAuthHandlers();
testCampaignManagement();
testAPIEndpoints();

// Summary
console.log('\n=== Test Summary ===');
const passed = testResults.filter(r => r.status === 'PASS').length;
const failed = testResults.filter(r => r.status === 'FAIL').length;
const warnings = testResults.filter(r => r.status === 'WARN').length;
const errors = testResults.filter(r => r.status === 'ERROR').length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`🔥 Errors: ${errors}`);

// Save results
const resultsPath = path.join(__dirname, `test-results-${Date.now()}.json`);
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\nDetailed results saved to: ${resultsPath}`);

// Exit with appropriate code
process.exit(failed + errors > 0 ? 1 : 0);
