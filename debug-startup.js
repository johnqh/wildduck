// Debug startup script with verbose logging
console.log('🔧 Starting WildDuck with debug logging...');
console.log('🔧 Node.js version:', process.version);

// Polyfill for Node.js v18 compatibility with undici
console.log('🔧 Setting up File API polyfill...');
global.File = class File {
  constructor(fileBits, fileName, options = {}) {
    this.name = fileName;
    this.size = 0;
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }

  arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
  text() { return Promise.resolve(''); }
  stream() { return new ReadableStream(); }
};
console.log('✅ File API polyfill ready');

// Add detailed logging for module loading
const originalRequire = require;
const moduleLoadLog = [];

require = function(id) {
  console.log(`📦 Loading module: ${id}`);
  moduleLoadLog.push({module: id, timestamp: Date.now()});

  try {
    const result = originalRequire.call(this, id);
    console.log(`✅ Loaded: ${id}`);
    return result;
  } catch (err) {
    console.log(`❌ Failed to load: ${id}`, err.message);
    throw err;
  }
};

// Trap for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('📋 Modules loaded so far:', moduleLoadLog.slice(-10));
});

// Trap for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.log('❌ Uncaught Exception:', error);
  console.log('📋 Modules loaded so far:', moduleLoadLog.slice(-10));
  process.exit(1);
});

console.log('🔧 Starting to load server.js...');

// Now start the server
require('./server.js');