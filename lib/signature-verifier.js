'use strict';

const { verifyMessage, isAddress: viemIsAddress } = require('viem');
const { PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

/**
 * Verifies a signature for blockchain-based authentication
 * @param {String} username - The username (address or name)
 * @param {String} signature - The signature to verify
 * @param {String} message - The message that was signed
 * @param {String} signerAddress - The expected signer address (for ENS/SNS)
 * @returns {Promise<Boolean>} - True if signature is valid
 */
async function verifySignature(username, signature, message, signerAddress = null) {
    if (!username || !signature || !message) {
        return false;
    }

    const cleanUsername = username.trim();
    
    // Determine the type of username and verify accordingly
    if (isEVMAddress(cleanUsername) || isBase64EVMAddress(cleanUsername)) {
        return await verifyEVMSignature(cleanUsername, signature, message);
    } else if (isSolanaAddress(cleanUsername)) {
        return verifySolanaSignature(cleanUsername, signature, message);
    } else if (isENSName(cleanUsername)) {
        // For ENS names, we need the owner address
        if (!signerAddress) {
            throw new Error('ENS owner address required for signature verification');
        }
        return await verifyEVMSignature(signerAddress, signature, message);
    } else if (isSNSName(cleanUsername)) {
        // For SNS names, we need the owner address
        if (!signerAddress) {
            throw new Error('SNS owner address required for signature verification');
        }
        return verifySolanaSignature(signerAddress, signature, message);
    }
    
    return false;
}

/**
 * Verifies an EVM (Ethereum) signature
 * @param {String} addressOrBase64 - EVM address or base64-encoded address
 * @param {String} signature - The signature in base64 or hex format (base64 for API, hex for compatibility)
 * @param {String} message - The original message
 * @returns {Boolean} - True if signature is valid
 */
async function verifyEVMSignature(addressOrBase64, signature, message) {
    try {
        let address;
        let signatureHex;
        
        // Handle base64-encoded addresses
        if (isBase64EVMAddress(addressOrBase64)) {
            const decoded = Buffer.from(addressOrBase64, 'base64').toString('hex');
            // Convert to proper checksum format
            address = '0x' + decoded;
            if (viemIsAddress(address)) {
                // viem handles checksumming internally - address is already valid
            }
        } else {
            address = addressOrBase64;
        }

        // Handle signature format - check if it's base64 or hex
        if (signature.startsWith('0x')) {
            // Already in hex format
            signatureHex = signature;
        } else if (/^[A-Za-z0-9+/]+=*$/.test(signature)) {
            // Looks like base64, decode it
            const decoded = Buffer.from(signature, 'base64').toString('hex');
            signatureHex = '0x' + decoded;
        } else {
            // Assume hex without 0x prefix
            signatureHex = '0x' + signature;
        }

        // Use viem to verify the signature
        const isValid = await verifyMessage({
            address,
            message,
            signature: signatureHex
        });

        return isValid;
    } catch (err) {
        console.error('EVM signature verification error:', err);
        return false;
    }
}

/**
 * Verifies a Solana signature
 * @param {String} address - Solana public key address
 * @param {String} signature - The signature in base58 format
 * @param {String} message - The original message
 * @returns {Boolean} - True if signature is valid
 */
function verifySolanaSignature(address, signature, message) {
    try {
        // Decode the public key
        const publicKey = new PublicKey(address);
        
        // Decode the signature from base58
        const signatureBytes = bs58.decode(signature);
        
        // Convert message to bytes
        const messageBytes = new TextEncoder().encode(message);
        
        // Verify the signature using tweetnacl
        const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKey.toBytes()
        );

        return isValid;
    } catch (err) {
        console.error('Solana signature verification error:', err);
        return false;
    }
}

/**
 * Creates a message for Sign-in with Ethereum (SIWE) format
 * @param {String} domain - The domain requesting authentication
 * @param {String} address - The Ethereum address
 * @param {String} nonce - Random nonce
 * @param {Date} issuedAt - Timestamp when message was created
 * @returns {String} - SIWE formatted message
 */
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

/**
 * Creates a message for Sign-in with Solana format
 * @param {String} domain - The domain requesting authentication
 * @param {String} address - The Solana address
 * @param {String} nonce - Random nonce
 * @param {Date} issuedAt - Timestamp when message was created
 * @returns {String} - Sign-in with Solana formatted message
 */
function createSolanaSignMessage(domain, address, nonce, issuedAt = new Date()) {
    return `${domain} wants you to sign in with your Solana account:
${address}

Sign in to ${domain}

Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}`;
}

/**
 * Generates a random nonce for signature messages
 * @returns {String} - Random nonce
 */
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Helper functions - import from blockchain-validator
function isEVMAddress(address) {
    try {
        return viemIsAddress(address);
    } catch (err) {
        return false;
    }
}

function isBase64EVMAddress(encoded) {
    try {
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        if (!base64Regex.test(encoded)) {
            return false;
        }
        const decoded = Buffer.from(encoded, 'base64').toString('hex');
        if (decoded.length !== 40) {
            return false;
        }
        const address = '0x' + decoded;
        return isEVMAddress(address);
    } catch (err) {
        return false;
    }
}

function isSolanaAddress(address) {
    try {
        if (!address || typeof address !== 'string' || address.length < 32 || address.length > 44) {
            return false;
        }
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(address)) {
            return false;
        }
        const decoded = bs58.decode(address);
        if (decoded.length !== 32) {
            return false;
        }
        // eslint-disable-next-line no-new
        new PublicKey(address);
        return true;
    } catch (err) {
        return false;
    }
}

function isENSName(name) {
    const lowerName = name.toLowerCase();
    if (!lowerName.endsWith('.eth') && !lowerName.endsWith('.box')) {
        return false;
    }
    const withoutTLD = lowerName.endsWith('.eth') 
        ? lowerName.slice(0, -4) 
        : lowerName.slice(0, -4);
    if (withoutTLD.length === 0) {
        return false;
    }
    const labels = withoutTLD.split('.');
    const validLabelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    for (const label of labels) {
        if (label.length === 0 || !validLabelRegex.test(label)) {
            return false;
        }
        if (label.includes('--')) {
            return false;
        }
    }
    return true;
}

function isSNSName(name) {
    const lowerName = name.toLowerCase();
    if (!lowerName.endsWith('.sol')) {
        return false;
    }
    const withoutTLD = lowerName.slice(0, -4);
    if (withoutTLD.length === 0) {
        return false;
    }
    const labels = withoutTLD.split('.');
    const validLabelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    for (const label of labels) {
        if (label.length === 0 || !validLabelRegex.test(label)) {
            return false;
        }
        if (label.includes('--')) {
            return false;
        }
    }
    return true;
}

module.exports = {
    verifySignature,
    verifyEVMSignature,
    verifySolanaSignature,
    createSIWEMessage,
    createSolanaSignMessage,
    generateNonce
};