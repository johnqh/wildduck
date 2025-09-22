// Polyfill for Node.js v18 compatibility with undici
// Provide missing File global that's expected by newer undici versions

// Basic File polyfill - this should be enough for undici to load
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

// Now start the server
require('./server.js');