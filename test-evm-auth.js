const testClient = require('./imap-core/test/test-client.js');

console.log('Testing LOGIN with EVM address...');

testClient(
    {
        commands: ['T1 LOGIN 0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7 pass', 'T2 LOGOUT'],
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

// Add timeout 
setTimeout(() => {
    console.log('Test timed out');
    process.exit(1);
}, 10000);