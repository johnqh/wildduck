const testClient = require('./imap-core/test/test-client.js');

console.log('Testing CAPABILITY without prepare.sh...');

// Simple CAPABILITY test without any setup
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
        console.log('=== SUCCESS ===');
        process.exit(0);
    }
);

// Add timeout 
setTimeout(() => {
    console.log('Test timed out');
    process.exit(1);
}, 5000);