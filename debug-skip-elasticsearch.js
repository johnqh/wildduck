// Debug startup script that skips ElasticSearch initialization
console.log('🔧 Starting WildDuck with Node.js v24, skipping ElasticSearch...');
console.log('🔧 Node.js version:', process.version);

// Set up the same environment as server.js
process.env.UV_THREADPOOL_SIZE = 16;

const fs = require('fs');
const log = require('npmlog');
const config = require('wild-config');
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

console.log('🔧 Printing logo...');
printLogo();

console.log('🔧 Skipping ElasticSearch initialization...');
console.log('🔧 Loading worker.js...');

// Skip ElasticSearch and go directly to worker
require('./worker.js');