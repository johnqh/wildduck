'use strict';

const { generatePrivateKey, privateKeyToAddress, signMessage } = require('viem/accounts');
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

// Note: createSIWEMessage, createSolanaSignMessage, and generateNonce
// are no longer available as they've been moved to mail_box_indexer service
// This test helper now implements local versions for testing only

/**
 * Local test implementations of helper functions
 */
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

function createSIWEMessage(domain, address, nonce, issuedAt = new Date()) {
    const uri = `https://${domain}`;
    const version = '1';
    const chainId = 1; // Ethereum mainnet
    
    return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to ${domain}

URI: ${uri}
Version: ${version}
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}`;
}

function createSolanaSignMessage(domain, address, nonce, issuedAt = new Date()) {
    return `${domain} wants you to sign in with your Solana account:
${address}

Sign in to ${domain}

Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}`;
}

/**
 * Test data generator for blockchain authentication
 */
class BlockchainTestHelpers {
    
    /**
     * Generate a complete EVM test user with wallet, signature, and auth data
     */
    static async generateEVMTestUser(domain = 'wildduck.email') {
        const privateKey = generatePrivateKey();
        const address = privateKeyToAddress(privateKey);
        const nonce = generateNonce();
        const message = createSIWEMessage(domain, address, nonce);
        const signature = await signMessage({
            message: message,
            privateKey: privateKey
        });

        return {
            type: 'evm',
            privateKey,
            address,
            username: address, // username is the address
            nonce,
            message,
            signature,
            authData: {
                username: address,
                signature,
                message,
                signerAddress: address
            },
            // For protocol testing (password field contains signature)
            protocolAuth: {
                username: address,
                password: signature // RFC-compliant: password field contains signature
            },
            // For enhanced protocol testing (JSON in password field)
            enhancedProtocolAuth: {
                username: address,
                password: JSON.stringify({
                    signature,
                    message,
                    signerAddress: address
                })
            }
        };
    }

    /**
     * Generate a complete Solana test user with keypair, signature, and auth data
     */
    static generateSolanaTestUser(domain = 'wildduck.email') {
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        const nonce = generateNonce();
        const message = createSolanaSignMessage(domain, address, nonce);
        
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
        const signature = bs58.encode(signatureBytes);

        return {
            type: 'solana',
            keypair,
            address,
            username: address, // username is the address
            nonce,
            message,
            signature,
            authData: {
                username: address,
                signature,
                message,
                signerAddress: address
            },
            // For protocol testing (password field contains signature)
            protocolAuth: {
                username: address,
                password: signature // RFC-compliant: password field contains signature
            },
            // For enhanced protocol testing (JSON in password field)
            enhancedProtocolAuth: {
                username: address,
                password: JSON.stringify({
                    signature,
                    message,
                    signerAddress: address
                })
            }
        };
    }

    /**
     * Generate test user with base64 encoded EVM address
     */
    static async generateBase64EVMTestUser(domain = 'wildduck.email') {
        const evmUser = await this.generateEVMTestUser(domain);
        
        // Convert address to base64 (without 0x prefix)
        const hexAddress = evmUser.address.slice(2);
        const base64Address = Buffer.from(hexAddress, 'hex').toString('base64');
        
        return {
            ...evmUser,
            username: base64Address,
            authData: {
                ...evmUser.authData,
                username: base64Address
            },
            protocolAuth: {
                username: base64Address,
                password: evmUser.signature
            },
            enhancedProtocolAuth: {
                username: base64Address,
                password: JSON.stringify({
                    signature: evmUser.signature,
                    message: evmUser.message,
                    signerAddress: evmUser.address // Keep original address as signer
                })
            }
        };
    }

    /**
     * Generate multiple test users for batch testing
     */
    static async generateTestUsers(count = 3, domain = 'wildduck.email') {
        const users = [];
        
        for (let i = 0; i < count; i++) {
            // Alternate between EVM and Solana
            if (i % 2 === 0) {
                users.push(await this.generateEVMTestUser(domain));
            } else {
                users.push(this.generateSolanaTestUser(domain));
            }
        }
        
        return users;
    }

    /**
     * Generate ENS-style test data (for testing name resolution)
     */
    static async generateENSTestData() {
        const evmUser = await this.generateEVMTestUser();
        
        return {
            ...evmUser,
            ensName: 'test.eth',
            username: 'test.eth',
            resolvedAddress: evmUser.address,
            authData: {
                ...evmUser.authData,
                username: 'test.eth'
            }
        };
    }

    /**
     * Generate SNS-style test data (for testing name resolution)
     */
    static generateSNSTestData() {
        const solanaUser = this.generateSolanaTestUser();
        
        return {
            ...solanaUser,
            snsName: 'test.sol',
            username: 'test.sol',
            resolvedAddress: solanaUser.address,
            authData: {
                ...solanaUser.authData,
                username: 'test.sol'
            }
        };
    }

    /**
     * Generate invalid test cases for negative testing
     */
    static generateInvalidTestCases() {
        return {
            invalidEVMSignature: {
                username: '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7',
                signature: '0x' + '0'.repeat(130), // Invalid signature
                message: 'Test message',
                type: 'evm'
            },
            invalidSolanaSignature: {
                username: '7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo',
                signature: 'invalidSignature123',
                message: 'Test message',
                type: 'solana'
            },
            invalidUsername: {
                username: 'not_a_blockchain_address',
                signature: '0x123456',
                message: 'Test message',
                type: 'invalid'
            },
            wrongMessage: {
                username: '0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7',
                signature: '0x123456',
                message: 'Wrong message content',
                type: 'evm'
            }
        };
    }

    /**
     * Create SASL PLAIN credentials for testing protocol interfaces
     */
    static createSASLPlainCredentials(username, password, authzid = '') {
        // SASL PLAIN format: [authzid]\0[username]\0[password]
        const credentials = `${authzid}\0${username}\0${password}`;
        return Buffer.from(credentials).toString('base64');
    }

    /**
     * Create enhanced SASL PLAIN credentials for blockchain auth
     */
    static createEnhancedSASLCredentials(username, signature, message, signerAddress, authzid = '') {
        // Enhanced format: [authzid]\0[username]\0[signature]\0[message]\0[signerAddress]
        const credentials = `${authzid}\0${username}\0${signature}\0${message}\0${signerAddress}`;
        return Buffer.from(credentials).toString('base64');
    }

    /**
     * Generate test data for protocol interface testing
     */
    static async generateProtocolTestData() {
        const evmUser = await this.generateEVMTestUser();
        const solanaUser = this.generateSolanaTestUser();
        
        return {
            evm: {
                ...evmUser,
                saslPlain: this.createSASLPlainCredentials(evmUser.username, evmUser.signature),
                saslEnhanced: this.createEnhancedSASLCredentials(
                    evmUser.username, 
                    evmUser.signature, 
                    evmUser.message, 
                    evmUser.address
                )
            },
            solana: {
                ...solanaUser,
                saslPlain: this.createSASLPlainCredentials(solanaUser.username, solanaUser.signature),
                saslEnhanced: this.createEnhancedSASLCredentials(
                    solanaUser.username, 
                    solanaUser.signature, 
                    solanaUser.message, 
                    solanaUser.address
                )
            }
        };
    }
}

module.exports = BlockchainTestHelpers;