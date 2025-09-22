// Debug startup script for Node.js v24 with verbose logging
console.log('🔧 Starting WildDuck with Node.js v24 debug logging...');
console.log('🔧 Node.js version:', process.version);

// Enhanced module loading tracker
const originalRequire = require;
const moduleLoadLog = [];
const moduleTimestamps = new Map();

require = function(id) {
  const startTime = Date.now();
  console.log(`📦 Loading module: ${id}`);
  moduleLoadLog.push({module: id, timestamp: startTime});
  moduleTimestamps.set(id, startTime);

  try {
    const result = originalRequire.call(this, id);
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    console.log(`✅ Loaded: ${id} (${loadTime}ms)`);
    return result;
  } catch (err) {
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    console.log(`❌ Failed to load: ${id} after ${loadTime}ms`, err.message);
    if (err.stack) {
      console.log('📋 Error stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
    throw err;
  }
};

// Enhanced promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Unhandled Rejection at:', promise);
  console.log('❌ Reason:', reason);
  if (reason && reason.stack) {
    console.log('📋 Stack:', reason.stack);
  }
  console.log('📋 Recent modules:', moduleLoadLog.slice(-5));
});

// Enhanced exception handling
process.on('uncaughtException', (error) => {
  console.log('❌ Uncaught Exception:', error.message);
  if (error.stack) {
    console.log('📋 Stack:', error.stack);
  }
  console.log('📋 Recent modules:', moduleLoadLog.slice(-5));
  process.exit(1);
});

// Add timeout warning
const startupTimeout = setTimeout(() => {
  console.log('⚠️  Startup taking longer than 30 seconds...');
  console.log('📋 Modules loaded so far:', moduleLoadLog.length);
  console.log('📋 Last 10 modules:', moduleLoadLog.slice(-10));
}, 30000);

console.log('🔧 Starting to load server.js...');

// Clear timeout if startup completes
process.on('exit', () => {
  clearTimeout(startupTimeout);
});

// Now start the server
require('./server.js');