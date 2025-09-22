// Debug startup script with timestamps for each step
const startTime = Date.now();

function logWithTime(message) {
    const elapsed = Date.now() - startTime;
    console.log(`[${elapsed}ms] ${message}`);
}

logWithTime('🔧 Starting WildDuck with Node.js v24 and timestamps...');
logWithTime('🔧 Node.js version: ' + process.version);

// Set up environment like server.js
process.env.UV_THREADPOOL_SIZE = 16;
process.env.NODE_ENV = 'test';

const config = require('wild-config');
const fs = require('fs');
const log = require('npmlog');
const packageData = require('./package.json');

log.level = config.log.level;

const printLogo = () => {
    let logo = fs
        .readFileSync(__dirname + '/logo.txt', 'utf-8')
        .replace(/^\n+|\n+$/g, '')
        .split('\n');

    let columnLength = logo.map(l => l.length).reduce((max, val) => (val > max ? val : max), 0);
    let versionString = ' ' + packageData.name + '@' + packageData.version + ' ';
    let versionPrefix = '-'.repeat(Math.round(columnLength / 2 - versionString.length / 2));
    let versionSuffix = '-'.repeat(columnLength - versionPrefix.length - versionString.length);

    log.info('App', ' ' + '-'.repeat(columnLength));
    log.info('App', '');

    logo.forEach(line => {
        log.info('App', ' ' + line);
    });

    log.info('App', '');
    log.info('App', ' ' + versionPrefix + versionString + versionSuffix);
    log.info('App', '');
};

logWithTime('🔧 Printing logo...');
printLogo();
logWithTime('✅ Logo printed');

logWithTime('🔧 Skipping ElasticSearch initialization...');
logWithTime('🔧 Loading worker.js...');

// Override console.log in worker.js to add timestamps
const originalConsoleLog = console.log;
console.log = function(...args) {
    if (args[0] && args[0].startsWith('Worker:') || args[0].startsWith('Tasks:')) {
        logWithTime(args[0]);
    } else {
        originalConsoleLog.apply(console, args);
    }
};

require('./worker.js');
logWithTime('✅ worker.js require completed');