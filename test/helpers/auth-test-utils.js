'use strict';

const crypto = require('crypto');
const { createWalletClient, http, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { mainnet } = require('viem/chains');
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

/**
 * Test utilities for authentication testing
 */

// Test wallet configurations
const TEST_WALLETS = {
    // EVM test wallet
    evm: {
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    },
    // Solana test wallet
    solana: {
        keypair: null, // Will be generated
        address: null
    },
    // ENS test (simulated)
    ens: {
        name: 'test.eth',
        ownerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // Same as EVM test wallet
    },
    // SNS test (simulated)
    sns: {
        name: 'test.sol',
        ownerAddress: null // Will be set to Solana address
    }
};

// Initialize Solana test wallet
function initializeSolanaWallet() {
    const keypair = Keypair.generate();
    TEST_WALLETS.solana.keypair = keypair;
    TEST_WALLETS.solana.address = keypair.publicKey.toString();
    TEST_WALLETS.sns.ownerAddress = keypair.publicKey.toString();
}

/**
 * Generate a random nonce
 */
function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Create standard authentication message
 */
function createAuthMessage(nonce) {
    return `Sign in to WildDuck\nNonce: ${nonce}`;
}

/**
 * Sign message with EVM wallet
 */
async function signEVMMessage(message, privateKey = TEST_WALLETS.evm.privateKey) {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
        account,
        chain: mainnet,
        transport: http()
    });
    
    const signature = await client.signMessage({
        account,
        message
    });
    
    return signature;
}

/**
 * Sign message with Solana wallet
 */
function signSolanaMessage(message, keypair = TEST_WALLETS.solana.keypair) {
    if (!keypair) {
        throw new Error('Solana wallet not initialized');
    }
    
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
}

/**
 * Convert hex signature to base64 (for EVM)
 */
function hexToBase64(hexString) {
    if (hexString.startsWith('0x')) {
        hexString = hexString.slice(2);
    }
    return Buffer.from(hexString, 'hex').toString('base64');
}

/**
 * Create test authentication data for API
 */
async function createAPIAuthData(type = 'evm', customNonce = null) {
    const nonce = customNonce || generateNonce();
    const message = createAuthMessage(nonce);
    let username, signature, signerAddress;
    
    switch (type) {
        case 'evm':
            username = TEST_WALLETS.evm.address;
            signature = await signEVMMessage(message);
            signature = hexToBase64(signature); // Convert to base64
            break;
            
        case 'solana':
            if (!TEST_WALLETS.solana.keypair) {
                initializeSolanaWallet();
            }
            username = TEST_WALLETS.solana.address;
            signature = signSolanaMessage(message);
            break;
            
        case 'ens':
            username = TEST_WALLETS.ens.name;
            signature = await signEVMMessage(message);
            signature = hexToBase64(signature);
            signerAddress = TEST_WALLETS.ens.ownerAddress;
            break;
            
        case 'sns':
            if (!TEST_WALLETS.solana.keypair) {
                initializeSolanaWallet();
            }
            username = TEST_WALLETS.sns.name;
            signature = signSolanaMessage(message);
            signerAddress = TEST_WALLETS.sns.ownerAddress;
            break;
            
        default:
            throw new Error(`Unknown wallet type: ${type}`);
    }
    
    return {
        username,
        signature,
        nonce,
        signerAddress,
        message
    };
}

/**
 * Create invalid authentication data for testing failures
 */
async function createInvalidAuthData(errorType = 'invalid-signature') {
    const nonce = generateNonce();
    
    switch (errorType) {
        case 'invalid-signature':
            return {
                username: TEST_WALLETS.evm.address,
                signature: 'aW52YWxpZF9zaWduYXR1cmU=', // "invalid_signature" in base64
                nonce
            };
            
        case 'invalid-username':
            return {
                username: 'invalid-address',
                signature: 'aW52YWxpZF9zaWduYXR1cmU=',
                nonce
            };
            
        case 'reused-nonce':
            const authData = await createAPIAuthData('evm', nonce);
            return {
                ...authData,
                reusedNonce: true
            };
            
        case 'missing-signer':
            return {
                username: TEST_WALLETS.ens.name,
                signature: hexToBase64(await signEVMMessage(createAuthMessage(nonce))),
                nonce
                // Missing signerAddress for ENS
            };
            
        default:
            throw new Error(`Unknown error type: ${errorType}`);
    }
}

/**
 * Mock MongoDB user data
 */
function createMockUserData(type = 'evm', exists = false) {
    if (!exists) {
        return null;
    }
    
    const baseUser = {
        _id: '507f1f77bcf86cd799439011',
        username: null,
        address: null,
        disabled: false,
        suspended: false,
        disabledScopes: [],
        blockchainAuth: {
            type: null,
            address: null,
            lastNonce: null,
            lastAuth: null
        }
    };
    
    switch (type) {
        case 'evm':
            baseUser.username = TEST_WALLETS.evm.address;
            baseUser.address = `${TEST_WALLETS.evm.address}@localhost`;
            baseUser.blockchainAuth.type = 'evm';
            baseUser.blockchainAuth.address = TEST_WALLETS.evm.address;
            break;
            
        case 'solana':
            if (!TEST_WALLETS.solana.address) {
                initializeSolanaWallet();
            }
            baseUser.username = TEST_WALLETS.solana.address;
            baseUser.address = `${TEST_WALLETS.solana.address}@localhost`;
            baseUser.blockchainAuth.type = 'solana';
            baseUser.blockchainAuth.address = TEST_WALLETS.solana.address;
            break;
            
        case 'ens':
            baseUser.username = TEST_WALLETS.ens.name;
            baseUser.address = `${TEST_WALLETS.ens.name}@localhost`;
            baseUser.blockchainAuth.type = 'evm';
            baseUser.blockchainAuth.address = TEST_WALLETS.ens.ownerAddress;
            break;
            
        case 'sns':
            if (!TEST_WALLETS.solana.address) {
                initializeSolanaWallet();
            }
            baseUser.username = TEST_WALLETS.sns.name;
            baseUser.address = `${TEST_WALLETS.sns.name}@localhost`;
            baseUser.blockchainAuth.type = 'solana';
            baseUser.blockchainAuth.address = TEST_WALLETS.sns.ownerAddress;
            break;
    }
    
    return baseUser;
}

// Initialize Solana wallet on module load
initializeSolanaWallet();

module.exports = {
    TEST_WALLETS,
    generateNonce,
    createAuthMessage,
    signEVMMessage,
    signSolanaMessage,
    hexToBase64,
    createAPIAuthData,
    createInvalidAuthData,
    createMockUserData,
    initializeSolanaWallet
};