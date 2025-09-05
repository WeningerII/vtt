#!/usr/bin/env node

/**
 * Test script to verify critical fixes
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Critical Fixes...\n');

// Test 1: WebSocket Provider Fix
console.log('1. WebSocket Provider - Checking for duplicate ping removal...');
const wsProviderPath = path.join(__dirname, 'apps/client/src/providers/WebSocketProvider.tsx');
const wsProviderContent = fs.readFileSync(wsProviderPath, 'utf-8');

if (!wsProviderContent.includes('setInterval(() => {') && 
    !wsProviderContent.includes('ws.send("ping")')) {
  console.log('   ✅ Duplicate ping interval removed');
} else {
  console.log('   ❌ Duplicate ping interval still present');
}

// Test 2: WSClient autoReconnect option
console.log('\n2. WSClient - Checking for autoReconnect option...');
const wsClientPath = path.join(__dirname, 'apps/client/src/net/ws.ts');
const wsClientContent = fs.readFileSync(wsClientPath, 'utf-8');

if (wsClientContent.includes('autoReconnect?: boolean') && 
    wsClientContent.includes('this.autoReconnect')) {
  console.log('   ✅ autoReconnect option added');
} else {
  console.log('   ❌ autoReconnect option missing');
}

// Test 3: Server Database Singleton
console.log('\n3. Server - Checking DatabaseManager singleton usage...');
const serverIndexPath = path.join(__dirname, 'apps/server/src/index.ts');
const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf-8');

if (serverIndexContent.includes('const prisma = DatabaseManager.getInstance()') &&
    serverIndexContent.includes('await DatabaseManager.disconnect()')) {
  console.log('   ✅ Using DatabaseManager singleton');
} else {
  console.log('   ❌ Not using DatabaseManager singleton properly');
}

// Test 4: Auth Middleware Singleton
console.log('\n4. Auth Middleware - Checking shared AuthManager...');
const authMiddlewarePath = path.join(__dirname, 'apps/server/src/middleware/auth.ts');
const authMiddlewareContent = fs.readFileSync(authMiddlewarePath, 'utf-8');

if (authMiddlewareContent.includes('getAuthManager()') &&
    authMiddlewareContent.includes('authManager.verifyAccessToken')) {
  console.log('   ✅ Using shared AuthManager instance');
} else {
  console.log('   ❌ Not using shared AuthManager properly');
}

// Test 5: AuthManager Singleton Implementation
console.log('\n5. AuthManager - Checking singleton implementation...');
const authManagerPath = path.join(__dirname, 'apps/server/src/auth/auth-manager.ts');
const authManagerContent = fs.readFileSync(authManagerPath, 'utf-8');

if (authManagerContent.includes('export function getAuthManager()') &&
    authManagerContent.includes('authManagerInstance')) {
  console.log('   ✅ Singleton pattern implemented');
} else {
  console.log('   ❌ Singleton pattern not implemented');
}

// Test 6: App.tsx Memory Leak Fix
console.log('\n6. App.tsx - Checking event listener cleanup...');
const appPath = path.join(__dirname, 'apps/client/src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

if (appContent.includes('return () => {') &&
    appContent.includes('window.removeEventListener("error"') &&
    appContent.includes('observer.disconnect()')) {
  console.log('   ✅ Event listeners properly cleaned up');
} else {
  console.log('   ❌ Event listeners not properly cleaned up');
}

console.log('\n✨ Verification complete!');
