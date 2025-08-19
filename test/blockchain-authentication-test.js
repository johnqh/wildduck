/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.config.includeStack = true;

const { createHash, randomBytes } = require('crypto');
const { generatePrivateKey, privateKeyToAddress, signMessage } = require('viem/accounts');
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

// Import blockchain authentication modules
const {
    isValidBlockchainIdentifier,
    isEVMAddress,
    isSolanaAddress,
    isENSName,
    isSNSName
} = require('../lib/blockchain-validator');

const {
    verifyEVMSignature,
    verifySolanaSignature,
    createSIWEMessage,
    createSolanaSignMessage,
    generateNonce
} = require('../lib/signature-verifier');

const {
    getAuthenticationAddress
} = require('../lib/name-resolver');

describe('Blockchain Authentication', function () {
    this.timeout(10000);

    describe('Blockchain Validator', function () {
        
        it('should validate EVM addresses correctly', function () {
            const validEVMAddresses = [
                '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7',
                '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
                '0x1234567890123456789012345678901234567890'
            ];

            const invalidEVMAddresses = [
                '742D35Cc6634C0532925A3B844bC9e7595f0bEB7', // missing 0x
                '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB', // too short
                '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB77', // too long
                '0xZZZZ35Cc6634C0532925A3B844bC9e7595f0bEB7' // invalid hex
            ];

            validEVMAddresses.forEach(address => {
                expect(isEVMAddress(address)).to.be.true;
                expect(isValidBlockchainIdentifier(address)).to.be.true;
            });

            invalidEVMAddresses.forEach(address => {
                expect(isEVMAddress(address)).to.be.false;
                expect(isValidBlockchainIdentifier(address)).to.be.false;
            });
        });

        it('should validate base64 encoded EVM addresses', function () {
            // Convert hex address to base64 (without 0x prefix)
            const hexAddress = '742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const base64Address = Buffer.from(hexAddress, 'hex').toString('base64');
            
            expect(isValidBlockchainIdentifier(base64Address)).to.be.true;
        });

        it('should validate Solana addresses correctly', function () {
            const validSolanaAddresses = [
                '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo',
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC token address
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT token address
            ];

            const invalidSolanaAddresses = [
                '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVj', // too short
                '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMoo', // too long
                '0VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo', // invalid base58
                'regular_username' // not base58
            ];

            validSolanaAddresses.forEach(address => {
                expect(isSolanaAddress(address)).to.be.true;
                expect(isValidBlockchainIdentifier(address)).to.be.true;
            });

            invalidSolanaAddresses.forEach(address => {
                expect(isSolanaAddress(address)).to.be.false;
                expect(isValidBlockchainIdentifier(address)).to.be.false;
            });
        });

        it('should validate ENS names correctly', function () {
            const validENSNames = [
                'vitalik.eth',
                'test.eth',
                'subdomain.test.eth',
                'example.box'
            ];

            const invalidENSNames = [
                'vitalik.com',
                'test.net',
                'notavalidextension.xyz'
            ];

            validENSNames.forEach(name => {
                expect(isENSName(name)).to.be.true;
                expect(isValidBlockchainIdentifier(name)).to.be.true;
            });

            invalidENSNames.forEach(name => {
                expect(isENSName(name)).to.be.false;
                expect(isValidBlockchainIdentifier(name)).to.be.false;
            });
        });

        it('should validate SNS names correctly', function () {
            const validSNSNames = [
                'example.sol',
                'test.sol',
                'username.sol'
            ];

            const invalidSNSNames = [
                'example.com',
                'test.net',
                'notsolana.xyz'
            ];

            validSNSNames.forEach(name => {
                expect(isSNSName(name)).to.be.true;
                expect(isValidBlockchainIdentifier(name)).to.be.true;
            });

            invalidSNSNames.forEach(name => {
                expect(isSNSName(name)).to.be.false;
                expect(isValidBlockchainIdentifier(name)).to.be.false;
            });
        });
    });

    describe('Message Generation', function () {
        
        it('should generate valid SIWE messages', function () {
            const domain = 'wildduck.email';
            const address = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const nonce = generateNonce();
            
            const message = createSIWEMessage(domain, address, nonce);
            
            expect(message).to.be.a('string');
            expect(message).to.include(domain);
            expect(message).to.include(address);
            expect(message).to.include(nonce);
            expect(message).to.include('wants you to sign in with your Ethereum account');
        });

        it('should generate valid Solana sign messages', function () {
            const domain = 'wildduck.email';
            const address = '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo';
            const nonce = generateNonce();
            
            const message = createSolanaSignMessage(domain, address, nonce);
            
            expect(message).to.be.a('string');
            expect(message).to.include(domain);
            expect(message).to.include(address);
            expect(message).to.include(nonce);
            expect(message).to.include('wants you to sign in with your Solana account');
        });

        it('should generate unique nonces', function () {
            const nonce1 = generateNonce();
            const nonce2 = generateNonce();
            const nonce3 = generateNonce();
            
            expect(nonce1).to.not.equal(nonce2);
            expect(nonce2).to.not.equal(nonce3);
            expect(nonce1).to.not.equal(nonce3);
            
            // Nonces should be at least 8 characters long
            expect(nonce1.length).to.be.at.least(8);
        });
    });

    describe('EVM Signature Verification', function () {
        let testWallet;
        let testAddress;
        let testMessage;
        let testSignature;

        before(async function () {
            // Create a test wallet for signing
            testWallet = generatePrivateKey();
            testAddress = privateKeyToAddress(testWallet);
            
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            testMessage = createSIWEMessage(domain, testAddress, nonce);
            
            // Sign the message
            testSignature = await signMessage({
                message: testMessage,
                privateKey: testWallet
            });
        });

        it('should verify valid EVM signatures', async function () {
            const isValid = await verifyEVMSignature(testAddress, testSignature, testMessage);
            expect(isValid).to.be.true;
        });

        it('should reject invalid EVM signatures', async function () {
            const invalidSignature = '0x' + '0'.repeat(130); // Invalid signature
            const isValid = await verifyEVMSignature(testAddress, invalidSignature, testMessage);
            expect(isValid).to.be.false;
        });

        it('should reject wrong message for EVM signature', async function () {
            const wrongMessage = 'This is not the original message';
            const isValid = await verifyEVMSignature(testAddress, testSignature, wrongMessage);
            expect(isValid).to.be.false;
        });

        it('should reject wrong address for EVM signature', async function () {
            const wrongAddress = '0x1234567890123456789012345678901234567890';
            const isValid = await verifyEVMSignature(wrongAddress, testSignature, testMessage);
            expect(isValid).to.be.false;
        });

        it('should handle base64 encoded EVM addresses', async function () {
            // Convert address to base64 (without 0x prefix)
            const hexAddress = testAddress.slice(2); // Remove 0x
            const base64Address = Buffer.from(hexAddress, 'hex').toString('base64');
            
            const isValid = await verifyEVMSignature(base64Address, testSignature, testMessage);
            expect(isValid).to.be.true;
        });
    });

    describe('Solana Signature Verification', function () {
        let testKeypair;
        let testAddress;
        let testMessage;
        let testSignature;

        before(function () {
            // Create a test keypair for signing
            testKeypair = Keypair.generate();
            testAddress = testKeypair.publicKey.toBase58();
            
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            testMessage = createSolanaSignMessage(domain, testAddress, nonce);
            
            // Sign the message
            const messageBytes = new TextEncoder().encode(testMessage);
            const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
            testSignature = bs58.encode(signatureBytes);
        });

        it('should verify valid Solana signatures', function () {
            const isValid = verifySolanaSignature(testAddress, testSignature, testMessage);
            expect(isValid).to.be.true;
        });

        it('should reject invalid Solana signatures', function () {
            const invalidSignature = 'invalidSignature123';
            const isValid = verifySolanaSignature(testAddress, invalidSignature, testMessage);
            expect(isValid).to.be.false;
        });

        it('should reject wrong message for Solana signature', function () {
            const wrongMessage = 'This is not the original message';
            const isValid = verifySolanaSignature(testAddress, testSignature, wrongMessage);
            expect(isValid).to.be.false;
        });

        it('should reject wrong address for Solana signature', function () {
            const wrongKeypair = Keypair.generate();
            const wrongAddress = wrongKeypair.publicKey.toBase58();
            const isValid = verifySolanaSignature(wrongAddress, testSignature, testMessage);
            expect(isValid).to.be.false;
        });
    });

    describe('Authentication Integration', function () {
        
        it('should create authentication data structure', function () {
            const username = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const signature = '0x1234567890abcdef';
            const message = 'Test message';
            const signerAddress = username;
            
            const authData = {
                username,
                signature,
                message,
                signerAddress
            };
            
            expect(authData).to.have.property('username');
            expect(authData).to.have.property('signature');
            expect(authData).to.have.property('message');
            expect(authData).to.have.property('signerAddress');
        });

        it('should format blockchain auth for protocol interfaces', function () {
            // Test how blockchain auth data would be formatted for IMAP/POP3
            const username = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const signature = '0x1234567890abcdef';
            const message = 'Test SIWE message';
            const signerAddress = username;
            
            // Test JSON format (enhanced blockchain auth)
            const blockchainAuthData = JSON.stringify({
                signature,
                message,
                signerAddress
            });
            
            expect(() => JSON.parse(blockchainAuthData)).to.not.throw();
            
            const parsed = JSON.parse(blockchainAuthData);
            expect(parsed.signature).to.equal(signature);
            expect(parsed.message).to.equal(message);
            expect(parsed.signerAddress).to.equal(signerAddress);
            
            // Test simple format (signature only)
            expect(signature).to.be.a('string');
            expect(signature.length).to.be.greaterThan(0);
        });
    });

    describe('Name Resolution', function () {
        
        it('should resolve EVM addresses directly', async function () {
            const evmAddress = '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const result = await getAuthenticationAddress(evmAddress);
            
            expect(result).to.be.an('object');
            expect(result.address).to.equal(evmAddress);
            expect(result.type).to.equal('evm');
        });

        it('should resolve base64 EVM addresses', async function () {
            const hexAddress = '742D35Cc6634C0532925A3B844bC9e7595f0bEB7';
            const base64Address = Buffer.from(hexAddress, 'hex').toString('base64');
            const result = await getAuthenticationAddress(base64Address);
            
            expect(result).to.be.an('object');
            expect(result.address).to.equal('0x' + hexAddress);
            expect(result.type).to.equal('evm');
        });

        it('should resolve Solana addresses directly', async function () {
            const solanaAddress = '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo';
            const result = await getAuthenticationAddress(solanaAddress);
            
            expect(result).to.be.an('object');
            expect(result.address).to.equal(solanaAddress);
            expect(result.type).to.equal('solana');
        });

        it('should return null for invalid addresses', async function () {
            const invalidAddress = 'not_a_valid_address';
            const result = await getAuthenticationAddress(invalidAddress);
            
            expect(result).to.be.null;
        });
    });

    describe('End-to-End Authentication Flow', function () {
        
        it('should complete full EVM authentication flow', async function () {
            // Step 1: Generate test wallet and message
            const testWallet = generatePrivateKey();
            const testAddress = privateKeyToAddress(testWallet);
            
            // Step 2: Create SIWE message
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            const message = createSIWEMessage(domain, testAddress, nonce);
            
            // Step 3: Sign message
            const signature = await signMessage({
                message: message,
                privateKey: testWallet
            });
            
            // Step 4: Validate blockchain identifier
            expect(isValidBlockchainIdentifier(testAddress)).to.be.true;
            
            // Step 5: Resolve authentication address
            const authResult = await getAuthenticationAddress(testAddress);
            expect(authResult.type).to.equal('evm');
            expect(authResult.address).to.equal(testAddress);
            
            // Step 6: Verify signature
            const isValid = await verifyEVMSignature(testAddress, signature, message);
            expect(isValid).to.be.true;
            
            console.log(`      ✅ EVM Authentication Flow: ${testAddress.substring(0, 10)}...`);
        });

        it('should complete full Solana authentication flow', async function () {
            // Step 1: Generate test keypair and message
            const testKeypair = Keypair.generate();
            const testAddress = testKeypair.publicKey.toBase58();
            
            // Step 2: Create Solana sign message
            const domain = 'wildduck.email';
            const nonce = generateNonce();
            const message = createSolanaSignMessage(domain, testAddress, nonce);
            
            // Step 3: Sign message
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = nacl.sign.detached(messageBytes, testKeypair.secretKey);
            const signature = bs58.encode(signatureBytes);
            
            // Step 4: Validate blockchain identifier
            expect(isValidBlockchainIdentifier(testAddress)).to.be.true;
            
            // Step 5: Resolve authentication address
            const authResult = await getAuthenticationAddress(testAddress);
            expect(authResult.type).to.equal('solana');
            expect(authResult.address).to.equal(testAddress);
            
            // Step 6: Verify signature
            const isValid = verifySolanaSignature(testAddress, signature, message);
            expect(isValid).to.be.true;
            
            console.log(`      ✅ Solana Authentication Flow: ${testAddress.substring(0, 10)}...`);
        });
    });
});