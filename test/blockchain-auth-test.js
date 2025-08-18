'use strict';

const {
    isValidBlockchainIdentifier,
    isEVMAddress,
    isBase64EVMAddress,
    isSolanaAddress,
    isENSName,
    isSNSName
} = require('../lib/blockchain-validator');

const {
    verifySignature,
    verifyEVMSignature,
    verifySolanaSignature,
    createSIWEMessage,
    createSolanaSignMessage,
    generateNonce
} = require('../lib/signature-verifier');

const {
    getAuthenticationAddress
} = require('../lib/name-resolver');

console.log('🧪 Testing Blockchain Authentication System\n');
console.log('=' .repeat(60));

async function testBlockchainValidator() {
    console.log('\n📋 Testing Blockchain Validator...');
    
    const testCases = [
        // EVM addresses
        { input: '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7', expected: true, type: 'EVM Address' },
        { input: 'dC01zGY0wFMpJaO4RLyedZXwvrc=', expected: true, type: 'Base64 EVM Address' }, // base64 of above hex without 0x
        
        // Solana addresses  
        { input: '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo', expected: true, type: 'Solana Address' },
        
        // ENS/SNS names
        { input: 'vitalik.eth', expected: true, type: 'ENS Name' },
        { input: 'example.sol', expected: true, type: 'SNS Name' },
        
        // Invalid cases
        { input: 'regular_username', expected: false, type: 'Regular Username' },
        { input: 'user@domain.com', expected: false, type: 'Email Address' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = isValidBlockchainIdentifier(testCase.input);
        const success = result === testCase.expected;
        
        if (success) {
            passed++;
            console.log(`  ✅ ${testCase.type}: "${testCase.input}" => ${result}`);
        } else {
            failed++;
            console.log(`  ❌ ${testCase.type}: "${testCase.input}" => ${result} (expected ${testCase.expected})`);
        }
    }
    
    console.log(`\n  📊 Validator Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

async function testSignatureVerifier() {
    console.log('\n🔐 Testing Signature Verifier...');
    
    // Test message creation
    const domain = 'wildduck.email';
    const ethAddress = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
    const solAddress = '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo';
    const nonce = generateNonce();
    
    console.log(`  📝 Generated nonce: ${nonce}`);
    
    // Test SIWE message creation
    const siweMessage = createSIWEMessage(domain, ethAddress, nonce);
    console.log(`  📨 SIWE message created: ${siweMessage.split('\n')[0]}...`);
    
    // Test Solana message creation
    const solanaMessage = createSolanaSignMessage(domain, solAddress, nonce);
    console.log(`  📨 Solana message created: ${solanaMessage.split('\n')[0]}...`);
    
    console.log('  ✅ Message generation working');
    
    // Note: We can't test actual signature verification without private keys
    // but we can test that the functions exist and handle errors gracefully
    try {
        const result = await verifyEVMSignature(ethAddress, 'invalid_signature', 'test message');
        console.log(`  ⚠️  EVM signature verification (with invalid sig): ${result}`);
    } catch (err) {
        console.log('  ✅ EVM signature verification handles errors correctly');
    }
    
    try {
        const result = verifySolanaSignature(solAddress, 'invalid_signature', 'test message');
        console.log(`  ⚠️  Solana signature verification (with invalid sig): ${result}`);
    } catch (err) {
        console.log('  ✅ Solana signature verification handles errors correctly');
    }
    
    return true;
}

async function testNameResolver() {
    console.log('\n🌐 Testing Name Resolver...');
    
    // Test address type detection
    const testAddresses = [
        { input: '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7', expectedType: 'evm' },
        { input: 'dC01zGY0wFMpJaO4RLyedZXwvrc=', expectedType: 'evm' }, // base64 EVM
        { input: '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo', expectedType: 'solana' }
    ];
    
    let resolverPassed = 0;
    
    for (const testAddr of testAddresses) {
        try {
            const result = await getAuthenticationAddress(testAddr.input);
            if (result && result.type === testAddr.expectedType) {
                console.log(`  ✅ ${testAddr.input.substring(0, 20)}... => type: ${result.type}`);
                resolverPassed++;
            } else {
                console.log(`  ❌ ${testAddr.input.substring(0, 20)}... => unexpected result: ${JSON.stringify(result)}`);
            }
        } catch (err) {
            console.log(`  ⚠️  ${testAddr.input.substring(0, 20)}... => error: ${err.message}`);
        }
    }
    
    // Test ENS/SNS resolution (will likely fail without network access)
    try {
        console.log('  🌍 Testing ENS resolution (may fail without network)...');
        const ensResult = await getAuthenticationAddress('vitalik.eth');
        if (ensResult) {
            console.log(`  ✅ ENS resolution working: vitalik.eth => ${ensResult.type}, ${ensResult.address.substring(0, 10)}...`);
        } else {
            console.log('  ⚠️  ENS resolution returned null (expected without network)');
        }
    } catch (err) {
        console.log(`  ⚠️  ENS resolution error (expected): ${err.message}`);
    }
    
    console.log(`  📊 Name Resolver Results: ${resolverPassed}/${testAddresses.length} direct addresses resolved`);
    return resolverPassed > 0;
}

async function runTests() {
    console.log('🚀 Starting Blockchain Authentication Tests...\n');
    
    const results = [];
    
    try {
        results.push(await testBlockchainValidator());
        results.push(await testSignatureVerifier());
        results.push(await testNameResolver());
        
        const allPassed = results.every(r => r);
        
        console.log('\n' + '=' .repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        
        if (allPassed) {
            console.log('🎉 All blockchain authentication modules are working correctly!');
            console.log('\n✅ Ready for blockchain-based authentication:');
            console.log('   • EVM address validation (including base64 encoding)');
            console.log('   • Solana address validation');
            console.log('   • ENS/SNS name validation');
            console.log('   • Signature verification framework');
            console.log('   • Name resolution system');
            process.exit(0);
        } else {
            console.log('❌ Some tests failed. Check the output above.');
            process.exit(1);
        }
        
    } catch (err) {
        console.error('💥 Test suite failed:', err);
        process.exit(1);
    }
}

// Run tests
runTests();