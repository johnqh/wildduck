const testClient = require('./imap-core/test/test-client.js');

console.log('Starting debug IMAP test...');

testClient(
    {
        commands: ['T1 CAPABILITY', 'T2 LOGOUT'],
        secure: false,
        port: 9993,
        debug: true
    },
    function (resp) {
        console.log('=== RESPONSE ===');
        console.log(resp.toString());
        console.log('=== END RESPONSE ===');
        process.exit(0);
    }
);

// Add timeout to prevent hanging
setTimeout(() => {
    console.log('Test timed out after 10 seconds');
    process.exit(1);
}, 10000);