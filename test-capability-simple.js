// Simple IMAP capability test without API dependency
const { ImapFlow } = require('imapflow');

async function testCapability() {
    console.log('Testing IMAP server capability...');

    const client = new ImapFlow({
        host: '127.0.0.1',
        port: 9993,
        secure: false,
        auth: {
            user: 'testuser',
            pass: 'testpass'
        },
        logger: false
    });

    try {
        console.log('Connecting to IMAP server...');
        await client.connect();
        console.log('✓ IMAP server connection successful');

        const capabilities = await client.capability();
        console.log('✓ CAPABILITY command successful');
        console.log('Server capabilities:', capabilities);

        await client.logout();
        console.log('✓ Test completed successfully');

        return true;
    } catch (err) {
        console.log('✗ Test failed:', err.message);
        return false;
    }
}

testCapability()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Test error:', err);
        process.exit(1);
    });
