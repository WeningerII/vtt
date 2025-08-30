/**
 * Jest Global Setup
 * Runs once before all tests begin
 */

module.exports = async () => {
  console.log('🚀 Starting VTT Test Suite...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.DATABASE_URL = 'memory://test-database';
  process.env.REDIS_URL = 'memory://test-cache';
  
  // Disable external services in tests
  process.env.DISABLE_ANALYTICS = 'true';
  process.env.DISABLE_MONITORING = 'true';
  process.env.DISABLE_EMAIL = 'true';
  
  // Mock service ports for testing
  process.env.AUTH_SERVICE_PORT = '0'; // Let system assign available port
  process.env.FILE_SERVICE_PORT = '0';
  process.env.WEBSOCKET_PORT = '0';
  
  // Set test timeouts
  process.env.REQUEST_TIMEOUT = '5000';
  process.env.DATABASE_TIMEOUT = '3000';
  
  // Performance monitoring disabled for faster tests
  process.env.PERFORMANCE_MONITORING = 'false';
  
  console.log('✅ Test environment configured');
};
