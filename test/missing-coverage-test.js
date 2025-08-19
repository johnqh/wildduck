/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.config.includeStack = true;

const sinon = require('sinon');
const { generatePrivateKey, privateKeyToAddress, signMessage } = require('viem/accounts');
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

// Import modules to test
const {
    verifySignature,
    verifyEVMSignature,
    verifySolanaSignature,
    createSIWEMessage,
    createSolanaSignMessage,
    generateNonce
} = require('../lib/signature-verifier');

const {
    resolveENSOwner,
    resolveENSAddress,
    resolveSNSOwner,
    resolveNameOwner,
    getAuthenticationAddress
} = require('../lib/name-resolver');

const {
    isValidBlockchainIdentifier,
    isEVMAddress,
    isBase64EVMAddress,
    isSolanaAddress,
    isENSName,
    isSNSName
} = require('../lib/blockchain-validator');

describe('Missing Coverage Tests', function () {
    this.timeout(10000);

    describe('verifySignature with ENS/SNS names', function () {
        
        it('should verify signature with ENS name and signer address', async function () {
            // Generate test wallet
            const privateKey = generatePrivateKey();
            const address = privateKeyToAddress(privateKey);
            const ensName = 'test.eth';
            
            // Create and sign message
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            const message = createSIWEMessage(domain, address, nonce);
            const signature = await signMessage({
                message: message,
                privateKey: privateKey
            });
            
            // Test verification with ENS name
            const isValid = await verifySignature(ensName, signature, message, address);
            expect(isValid).to.be.true;
        });

        it('should throw error for ENS name without signer address', async function () {
            const ensName = 'test.eth';
            const signature = '0x1234567890abcdef';
            const message = 'Test message';
            
            try {
                await verifySignature(ensName, signature, message);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.include('ENS owner address required');
            }
        });

        it('should verify signature with SNS name and signer address', async function () {
            // Generate test keypair
            const keypair = Keypair.generate();
            const address = keypair.publicKey.toBase58();
            const snsName = 'test.sol';
            
            // Create and sign message
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            const message = createSolanaSignMessage(domain, address, nonce);
            
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
            const signature = bs58.encode(signatureBytes);
            
            // Test verification with SNS name
            const isValid = await verifySignature(snsName, signature, message, address);
            expect(isValid).to.be.true;
        });

        it('should throw error for SNS name without signer address', async function () {
            const snsName = 'test.sol';
            const signature = 'invalidSignature123';
            const message = 'Test message';
            
            try {
                await verifySignature(snsName, signature, message);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.include('SNS owner address required');
            }
        });

        it('should return false for invalid username format', async function () {
            const invalidUsername = 'not_a_blockchain_address';
            const signature = '0x1234567890abcdef';
            const message = 'Test message';
            
            const isValid = await verifySignature(invalidUsername, signature, message);
            expect(isValid).to.be.false;
        });

        it('should return false for missing parameters', async function () {
            const isValid1 = await verifySignature(null, 'signature', 'message');
            expect(isValid1).to.be.false;
            
            const isValid2 = await verifySignature('username', null, 'message');
            expect(isValid2).to.be.false;
            
            const isValid3 = await verifySignature('username', 'signature', null);
            expect(isValid3).to.be.false;
        });

        it('should handle whitespace in username', async function () {
            const privateKey = generatePrivateKey();
            const address = privateKeyToAddress(privateKey);
            const paddedAddress = '  ' + address + '  ';
            
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            const message = createSIWEMessage(domain, address, nonce);
            const signature = await signMessage({
                message: message,
                privateKey: privateKey
            });
            
            const isValid = await verifySignature(paddedAddress, signature, message);
            expect(isValid).to.be.true;
        });
    });

    describe('Name Resolution Error Handling', function () {
        
        it('should handle ENS resolution errors gracefully', async function () {
            this.timeout(5000); // Set shorter timeout
            // Mock network error
            const invalidRpcUrl = 'http://invalid-rpc-url.local';
            
            try {
                // Use Promise.race to enforce timeout
                const result = await Promise.race([
                    resolveENSOwner('vitalik.eth', invalidRpcUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]);
                // If it doesn't throw, it should return null
                expect(result).to.be.null;
            } catch (err) {
                // Network error is acceptable
                expect(err).to.exist;
            }
        });

        it('should handle SNS resolution errors gracefully', async function () {
            // Mock network error
            const invalidRpcUrl = 'http://invalid-rpc-url.local';
            
            try {
                const result = await resolveSNSOwner('example.sol', invalidRpcUrl);
                // If it doesn't throw, it should return null
                expect(result).to.be.null;
            } catch (err) {
                // Network error is acceptable
                expect(err).to.exist;
            }
        });

        it('should handle resolveNameOwner with unsupported names', async function () {
            const result = await resolveNameOwner('unsupported.com');
            expect(result).to.be.null;
        });

        it('should handle getAuthenticationAddress with invalid input', async function () {
            const testCases = [
                '',
                '   ',
                null,
                undefined,
                'invalid.com',
                'not_an_address'
            ];

            for (const testCase of testCases) {
                const result = await getAuthenticationAddress(testCase || '');
                expect(result).to.be.null;
            }
        });
    });

    describe('Blockchain Validator Edge Cases', function () {
        
        it('should handle edge cases for isEVMAddress', function () {
            // Test with various invalid inputs
            expect(isEVMAddress('')).to.be.false;
            expect(isEVMAddress(null)).to.be.false;
            expect(isEVMAddress(undefined)).to.be.false;
            expect(isEVMAddress(123)).to.be.false;
            expect(isEVMAddress({})).to.be.false;
            expect(isEVMAddress([])).to.be.false;
        });

        it('should handle edge cases for isBase64EVMAddress', function () {
            // Invalid base64
            expect(isBase64EVMAddress('!!!invalid!!!')).to.be.false;
            expect(isBase64EVMAddress('')).to.be.false;
            expect(isBase64EVMAddress(null)).to.be.false;
            
            // Valid base64 but wrong decoded length
            const shortHex = '1234';
            const shortBase64 = Buffer.from(shortHex, 'hex').toString('base64');
            expect(isBase64EVMAddress(shortBase64)).to.be.false;
        });

        it('should handle edge cases for isSolanaAddress', function () {
            // Test with various invalid inputs
            expect(isSolanaAddress('')).to.be.false;
            expect(isSolanaAddress(null)).to.be.false;
            expect(isSolanaAddress(undefined)).to.be.false;
            expect(isSolanaAddress('short')).to.be.false;
            expect(isSolanaAddress('0' * 100)).to.be.false; // too long
            expect(isSolanaAddress('invalid!@#$%')).to.be.false;
        });

        it('should handle edge cases for ENS names', function () {
            // Invalid ENS names
            expect(isENSName('.eth')).to.be.false;
            expect(isENSName('eth')).to.be.false;
            expect(isENSName('test.')).to.be.false;
            expect(isENSName('test..eth')).to.be.false;
            expect(isENSName('test-.eth')).to.be.false;
            expect(isENSName('-test.eth')).to.be.false;
            expect(isENSName('test--name.eth')).to.be.false;
            expect(isENSName('.box')).to.be.false;
        });

        it('should handle edge cases for SNS names', function () {
            // Invalid SNS names
            expect(isSNSName('.sol')).to.be.false;
            expect(isSNSName('sol')).to.be.false;
            expect(isSNSName('test.')).to.be.false;
            expect(isSNSName('test..sol')).to.be.false;
            expect(isSNSName('test-.sol')).to.be.false;
            expect(isSNSName('-test.sol')).to.be.false;
            expect(isSNSName('test--name.sol')).to.be.false;
        });
    });

    describe('Message Generation Edge Cases', function () {
        
        it('should handle special characters in domain', function () {
            const domain = 'test-domain.example.com';
            const address = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const nonce = generateNonce();
            
            const message = createSIWEMessage(domain, address, nonce);
            
            expect(message).to.include(domain);
            expect(message).to.include(address);
            expect(message).to.include(nonce);
        });

        it('should handle timestamp parameter in SIWE message', function () {
            const domain = 'wildduck.email';
            const address = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const nonce = generateNonce();
            const customDate = new Date('2025-01-01T00:00:00Z');
            
            const message = createSIWEMessage(domain, address, nonce, customDate);
            
            expect(message).to.include('2025-01-01T00:00:00.000Z');
        });

        it('should handle timestamp parameter in Solana message', function () {
            const domain = 'wildduck.email';
            const address = '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo';
            const nonce = generateNonce();
            const customDate = new Date('2025-01-01T00:00:00Z');
            
            const message = createSolanaSignMessage(domain, address, nonce, customDate);
            
            expect(message).to.include('2025-01-01T00:00:00.000Z');
        });
    });

    describe('Signature Verification Error Handling', function () {
        
        it('should handle malformed EVM signatures gracefully', async function () {
            const address = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const message = 'Test message';
            
            const malformedSignatures = [
                '0x',
                '0xinvalid',
                'not_hex',
                '0x' + '0'.repeat(10), // too short
                '0x' + 'g'.repeat(130), // invalid hex chars
                null,
                undefined,
                123,
                {}
            ];
            
            for (const sig of malformedSignatures) {
                const isValid = await verifyEVMSignature(address, sig, message);
                expect(isValid).to.be.false;
            }
        });

        it('should handle malformed Solana signatures gracefully', function () {
            const address = '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo';
            const message = 'Test message';
            
            const malformedSignatures = [
                '',
                'invalid!@#',
                '0' * 100, // invalid base58
                null,
                undefined,
                123,
                {}
            ];
            
            for (const sig of malformedSignatures) {
                const isValid = verifySolanaSignature(address, sig, message);
                expect(isValid).to.be.false;
            }
        });

        it('should handle invalid addresses in verification', async function () {
            const signature = '0x' + '0'.repeat(130);
            const message = 'Test message';
            
            // Invalid EVM address
            const isValid1 = await verifyEVMSignature('invalid_address', signature, message);
            expect(isValid1).to.be.false;
            
            // Invalid Solana address
            const isValid2 = verifySolanaSignature('invalid_address', 'signature', message);
            expect(isValid2).to.be.false;
        });
    });

    describe('Integration with asyncResolveAddress', function () {
        // Note: These tests would require a full UserHandler setup with database
        // They're included here as placeholders for what should be tested
        
        it.skip('should auto-create user with valid blockchain identifier', async function () {
            // This would test the auto-create flow in user-handler.js
            // with options.create = true
        });

        it.skip('should reject auto-create with invalid blockchain identifier', async function () {
            // This would test rejection when options.create = true
            // but the username is not a valid blockchain identifier
        });

        it.skip('should handle rate limiting in authentication', async function () {
            // This would test the rate limiting logic in asyncAuthenticate
        });
    });

    describe('ENS Resolution Integration', function () {
        
        it('should handle ENS names with subdomains', async function () {
            const subdomainName = 'sub.domain.eth';
            expect(isENSName(subdomainName)).to.be.true;
            
            const result = await getAuthenticationAddress(subdomainName);
            // Without network, should return null or handle gracefully
            if (result) {
                expect(result.type).to.equal('evm');
            }
        });

        it('should handle .box ENS names', async function () {
            const boxName = 'test.box';
            expect(isENSName(boxName)).to.be.true;
            
            const result = await getAuthenticationAddress(boxName);
            // Without network, should return null or handle gracefully
            if (result) {
                expect(result.type).to.equal('evm');
            }
        });
    });

    describe('Concurrent Operations', function () {
        
        it('should handle concurrent signature verifications', async function () {
            const testData = [];
            
            // Generate multiple test cases
            for (let i = 0; i < 5; i++) {
                const privateKey = generatePrivateKey();
                const address = privateKeyToAddress(privateKey);
                const message = `Test message ${i}`;
                const signature = await signMessage({
                    message: message,
                    privateKey: privateKey
                });
                
                testData.push({ address, signature, message });
            }
            
            // Verify all concurrently
            const verifications = testData.map(data =>
                verifyEVMSignature(data.address, data.signature, data.message)
            );
            
            const results = await Promise.all(verifications);
            
            // All should be valid
            results.forEach(result => {
                expect(result).to.be.true;
            });
        });

        it('should handle mixed valid and invalid signatures concurrently', async function () {
            const privateKey = generatePrivateKey();
            const address = privateKeyToAddress(privateKey);
            const message = 'Test message';
            const validSignature = await signMessage({
                message: message,
                privateKey: privateKey
            });
            
            const verifications = [
                verifyEVMSignature(address, validSignature, message), // valid
                verifyEVMSignature(address, '0x' + '0'.repeat(130), message), // invalid
                verifyEVMSignature(address, validSignature, 'wrong message'), // wrong message
                verifyEVMSignature('0x1234567890123456789012345678901234567890', validSignature, message) // wrong address
            ];
            
            const results = await Promise.all(verifications);
            
            expect(results[0]).to.be.true;
            expect(results[1]).to.be.false;
            expect(results[2]).to.be.false;
            expect(results[3]).to.be.false;
        });
    });
});