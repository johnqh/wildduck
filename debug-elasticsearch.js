// Debug script to test ElasticSearch initialization
console.log('🔧 Testing ElasticSearch initialization...');
console.log('🔧 Node.js version:', process.version);

const config = require('wild-config');
console.log('🔧 ElasticSearch config:', {
    enabled: config.elasticsearch.enabled,
    url: config.elasticsearch.url
});

const { init: initElasticSearch } = require('./lib/elasticsearch');

console.log('🔧 Calling initElasticSearch...');

const startTime = Date.now();

initElasticSearch()
    .then(started => {
        const duration = Date.now() - startTime;
        console.log(`✅ ElasticSearch init completed in ${duration}ms, started: ${started}`);
        process.exit(0);
    })
    .catch(err => {
        const duration = Date.now() - startTime;
        console.log(`❌ ElasticSearch init failed after ${duration}ms:`, err.message);
        process.exit(1);
    });

// Add timeout warning
setTimeout(() => {
    const duration = Date.now() - startTime;
    console.log(`⚠️  ElasticSearch init is taking longer than 10 seconds (${duration}ms)...`);
}, 10000);