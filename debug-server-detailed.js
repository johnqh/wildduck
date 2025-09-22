// More detailed debug of server.js startup flow
console.log('🔧 Starting detailed server debug...');
console.log('🔧 Node.js version:', process.version);

// Set up environment like server.js
process.env.UV_THREADPOOL_SIZE = 16;

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

console.log('🔧 Step 1: Printing logo...');
printLogo();

console.log('🔧 Step 2: Loading ElasticSearch module...');
const { init: initElasticSearch } = require('./lib/elasticsearch');

console.log('🔧 Step 3: Calling initElasticSearch...');
const startTime = Date.now();

initElasticSearch()
    .then(started => {
        const duration = Date.now() - startTime;
        console.log(`🔧 Step 4: ElasticSearch init completed in ${duration}ms, started: ${started}`);

        console.log('🔧 Step 5: Loading worker.js...');
        try {
            require('./worker.js');
            console.log('🔧 Step 6: worker.js loaded successfully');
        } catch (err) {
            console.log('❌ Step 6 failed: worker.js load error:', err.message);
            console.log('📋 Stack:', err.stack);
        }
    })
    .catch(err => {
        const duration = Date.now() - startTime;
        console.log(`❌ Step 4 failed: ElasticSearch init failed after ${duration}ms:`, err.message);
        console.log('📋 Stack:', err.stack);
    });

// Add timeout warnings
setTimeout(() => {
    console.log('⚠️  Startup taking longer than 10 seconds...');
}, 10000);

setTimeout(() => {
    console.log('⚠️  Startup taking longer than 30 seconds...');
}, 30000);