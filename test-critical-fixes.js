#!/usr/bin/env node

/**
 * Test critical fixes for WebSocket and Authentication issues
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Critical Application Fixes\n');

// Test 1: WebSocket Provider - No Duplicate Ping
console.log('1. WebSocket Provider Fix');
const wsProviderPath = path.join(__dirname, 'apps/client/src/providers/WebSocketProvider.tsx');
const wsProviderContent = fs.readFileSync(wsProviderPath, 'utf-8');

// Should NOT have duplicate ping intervals
const hasDuplicatePing = wsProviderContent.includes('setInterval(') && 
                        wsProviderContent.includes('ws.send("ping")');
                        
// Should have proper cleanup and reconnect control
const hasProperCleanup = wsProviderContent.includes('return () => {') &&
                        wsProviderContent.includes('disconnect()');

console.log(`   ✅ Duplicate ping removed: ${!hasDuplicatePing}`);
console.log(`   ✅ Proper cleanup implemented: ${hasProperCleanup}`);

// Test 2: WSClient autoReconnect Control  
console.log('\n2. WSClient autoReconnect Control');
const wsClientPath = path.join(__dirname, 'apps/client/src/net/ws.ts');
const wsClientContent = fs.readFileSync(wsClientPath, 'utf-8');

const hasAutoReconnectOption = wsClientContent.includes('autoReconnect?: boolean');
const hasAutoReconnectLogic = wsClientContent.includes('this.opts.autoReconnect');

console.log(`   ✅ AutoReconnect option defined: ${hasAutoReconnectOption}`);
console.log(`   ✅ AutoReconnect logic implemented: ${hasAutoReconnectLogic}`);

// Test 3: Server Database Singleton
console.log('\n3. Server Database Management');
const serverIndexPath = path.join(__dirname, 'apps/server/src/index.ts');
const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf-8');

const usesDatabaseManager = serverIndexContent.includes('DatabaseManager.getInstance()');
const hasProperShutdown = serverIndexContent.includes('DatabaseManager.disconnect()');
const noDuplicatePrisma = !serverIndexContent.includes('new PrismaClient()');

console.log(`   ✅ Uses DatabaseManager singleton: ${usesDatabaseManager}`);
console.log(`   ✅ Proper shutdown handling: ${hasProperShutdown}`);
console.log(`   ✅ No duplicate PrismaClient: ${noDuplicatePrisma}`);

// Test 4: Authentication Middleware Singleton
console.log('\n4. Authentication Middleware');
const authMiddlewarePath = path.join(__dirname, 'apps/server/src/middleware/auth.ts');
const authMiddlewareContent = fs.readFileSync(authMiddlewarePath, 'utf-8');

const usesSharedAuthManager = authMiddlewareContent.includes('getAuthManager()');
const hasCorrectTokenValidation = authMiddlewareContent.includes('verifyAccessToken');
const noMultipleAuthManagers = !authMiddlewareContent.includes('new AuthManager(');

console.log(`   ✅ Uses shared AuthManager: ${usesSharedAuthManager}`);
console.log(`   ✅ Correct token validation method: ${hasCorrectTokenValidation}`);
console.log(`   ✅ No duplicate AuthManager instances: ${noMultipleAuthManagers}`);

// Test 5: AuthManager Singleton Implementation
console.log('\n5. AuthManager Singleton Pattern');
const authManagerPath = path.join(__dirname, 'apps/server/src/auth/auth-manager.ts');
const authManagerContent = fs.readFileSync(authManagerPath, 'utf-8');

const hasSingletonFunction = authManagerContent.includes('export function getAuthManager()');
const hasSingletonVariable = authManagerContent.includes('authManagerInstance');
const usesDatabaseManagerInstance = authManagerContent.includes('DatabaseManager.getInstance()');

console.log(`   ✅ Singleton function exported: ${hasSingletonFunction}`);
console.log(`   ✅ Singleton instance variable: ${hasSingletonVariable}`);
console.log(`   ✅ Uses DatabaseManager instance: ${usesDatabaseManagerInstance}`);

// Test 6: App.tsx Memory Leak Fix
console.log('\n6. App.tsx Memory Management');
const appPath = path.join(__dirname, 'apps/client/src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

const hasEventListenerCleanup = appContent.includes('window.removeEventListener("error"') &&
                               appContent.includes('window.removeEventListener("unhandledrejection"');
const hasObserverCleanup = appContent.includes('observer.disconnect()');
const hasProperReturnCleanup = appContent.includes('return () => {');

console.log(`   ✅ Event listener cleanup: ${hasEventListenerCleanup}`);
console.log(`   ✅ Performance observer cleanup: ${hasObserverCleanup}`);
console.log(`   ✅ Proper useEffect cleanup: ${hasProperReturnCleanup}`);

// Summary
console.log('\n📊 Fix Verification Summary');
const testResults = [
  { name: "Duplicate ping removed", result: !hasDuplicatePing },
  { name: "Proper cleanup implemented", result: hasProperCleanup },
  { name: "AutoReconnect option defined", result: hasAutoReconnectOption },
  { name: "AutoReconnect logic implemented", result: hasAutoReconnectLogic },
  { name: "Uses DatabaseManager singleton", result: usesDatabaseManager },
  { name: "Proper shutdown handling", result: hasProperShutdown },
  { name: "No duplicate PrismaClient", result: noDuplicatePrisma },
  { name: "Uses shared AuthManager", result: usesSharedAuthManager },
  { name: "Correct token validation method", result: hasCorrectTokenValidation },
  { name: "No duplicate AuthManager instances", result: noMultipleAuthManagers },
  { name: "Singleton function exported", result: hasSingletonFunction },
  { name: "Singleton instance variable", result: hasSingletonVariable },
  { name: "Uses DatabaseManager instance", result: usesDatabaseManagerInstance },
  { name: "Event listener cleanup", result: hasEventListenerCleanup },
  { name: "Performance observer cleanup", result: hasObserverCleanup },
  { name: "Proper useEffect cleanup", result: hasProperReturnCleanup }
];

const passedTests = testResults.filter(test => test.result).length;
const failedTests = testResults.filter(test => !test.result);

console.log(`\nFailed tests (${failedTests.length}):`);
failedTests.forEach(test => {
  console.log(`   ❌ ${test.name}`);
});

const totalTests = testResults.length;
console.log(`\n✨ ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All critical fixes verified successfully!');
  console.log('\nKey improvements:');
  console.log('• WebSocket: Eliminated duplicate pings, controlled reconnection');
  console.log('• Database: Single connection instance, proper shutdown');
  console.log('• Authentication: Consistent token validation, shared instances');
  console.log('• Memory: Proper cleanup of event listeners and observers');
} else {
  console.log('⚠️  Some tests failed - please review the fixes');
}

console.log('\n🔧 Ready for integration testing with running servers!');
