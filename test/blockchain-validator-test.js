'use strict';

const {
    isValidBlockchainIdentifier,
    isEVMAddress,
    isSolanaAddress,
    isENSName,
    isSNSName
} = require('../lib/blockchain-validator');

console.log('Testing Blockchain Validator\n');
console.log('=' .repeat(50));

// Test cases
const testCases = [
    // EVM Addresses
    { input: '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7', expected: true, type: 'EVM Address (checksummed)' },
    { input: '0x742d35cc6634c0532925a3b844bc9e7595f0beb7', expected: true, type: 'EVM Address (lowercase)' },
    { input: '0x0000000000000000000000000000000000000000', expected: true, type: 'EVM Address (zero address)' },
    { input: '0xinvalid', expected: false, type: 'Invalid EVM Address' },
    { input: '742d35Cc6634C0532925a3b844Bc9e7595f0bEb7', expected: false, type: 'EVM Address without 0x' },
    
    // Solana Addresses
    { input: '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo', expected: true, type: 'Solana Address' },
    { input: '11111111111111111111111111111111', expected: true, type: 'Solana System Program' },
    { input: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', expected: true, type: 'Solana USDC Address' },
    { input: 'invalid_solana_address', expected: false, type: 'Invalid Solana Address' },
    { input: 'tooshort', expected: false, type: 'Too short for Solana' },
    
    // ENS Names
    { input: 'vitalik.eth', expected: true, type: 'ENS .eth name' },
    { input: 'abc.box', expected: true, type: 'ENS .box name' },
    { input: 'sub.domain.eth', expected: true, type: 'ENS subdomain' },
    { input: 'valid-name.eth', expected: true, type: 'ENS with hyphen' },
    { input: '123.eth', expected: true, type: 'ENS numeric' },
    { input: 'a.eth', expected: true, type: 'ENS single char' },
    { input: '.eth', expected: false, type: 'Empty ENS name' },
    { input: '-invalid.eth', expected: false, type: 'ENS starting with hyphen' },
    { input: 'invalid-.eth', expected: false, type: 'ENS ending with hyphen' },
    { input: 'invalid--name.eth', expected: false, type: 'ENS with double hyphen' },
    { input: 'UPPERCASE.eth', expected: true, type: 'ENS uppercase (case-insensitive)' },
    { input: 'notens.com', expected: false, type: 'Not an ENS name' },
    
    // SNS Names
    { input: 'example.sol', expected: true, type: 'SNS name' },
    { input: 'sub.domain.sol', expected: true, type: 'SNS subdomain' },
    { input: 'valid-name.sol', expected: true, type: 'SNS with hyphen' },
    { input: '123.sol', expected: true, type: 'SNS numeric' },
    { input: 'a.sol', expected: true, type: 'SNS single char' },
    { input: '.sol', expected: false, type: 'Empty SNS name' },
    { input: '-invalid.sol', expected: false, type: 'SNS starting with hyphen' },
    { input: 'invalid-.sol', expected: false, type: 'SNS ending with hyphen' },
    { input: 'invalid--name.sol', expected: false, type: 'SNS with double hyphen' },
    { input: 'UPPERCASE.sol', expected: true, type: 'SNS uppercase (case-insensitive)' },
    
    // Mixed/Edge cases
    { input: '', expected: false, type: 'Empty string' },
    { input: null, expected: false, type: 'Null value' },
    { input: undefined, expected: false, type: 'Undefined value' },
    { input: 'regular_username', expected: false, type: 'Regular username' },
    { input: 'user@domain.com', expected: false, type: 'Email address' }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\nRunning isValidBlockchainIdentifier tests:\n');

testCases.forEach(testCase => {
    const result = isValidBlockchainIdentifier(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
        passed++;
        console.log(`✓ ${testCase.type}: "${testCase.input}" => ${result}`);
    } else {
        failed++;
        console.log(`✗ ${testCase.type}: "${testCase.input}" => ${result} (expected ${testCase.expected})`);
    }
});

console.log('\n' + '=' .repeat(50));
console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

// Individual function tests
console.log('\n' + '=' .repeat(50));
console.log('\nTesting individual validators:\n');

// Test EVM addresses
console.log('EVM Address Tests:');
console.log(`  isEVMAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7'): ${isEVMAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7')}`);
console.log(`  isEVMAddress('invalid'): ${isEVMAddress('invalid')}`);

// Test Solana addresses
console.log('\nSolana Address Tests:');
console.log(`  isSolanaAddress('7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo'): ${isSolanaAddress('7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo')}`);
console.log(`  isSolanaAddress('invalid'): ${isSolanaAddress('invalid')}`);

// Test ENS names
console.log('\nENS Name Tests:');
console.log(`  isENSName('vitalik.eth'): ${isENSName('vitalik.eth')}`);
console.log(`  isENSName('example.box'): ${isENSName('example.box')}`);
console.log(`  isENSName('invalid.com'): ${isENSName('invalid.com')}`);

// Test SNS names
console.log('\nSNS Name Tests:');
console.log(`  isSNSName('example.sol'): ${isSNSName('example.sol')}`);
console.log(`  isSNSName('invalid.com'): ${isSNSName('invalid.com')}`);

console.log('\n' + '=' .repeat(50));

// Exit with appropriate code
if (failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
}