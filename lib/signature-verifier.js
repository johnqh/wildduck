'use strict';

const config = require('wild-config');
const axios = require('axios');
const { resolveENSOwner, resolveSNSOwner } = require('./name-resolver');

/**
 * Verifies a signature for blockchain-based authentication using mail_box_indexer service
 * @param {String} username - The username (address or name)
 * @param {String} signature - The signature to verify
 * @param {String} nonce - The nonce that was signed (required for cryptographic verification)
 * @returns {Promise<Boolean>} - True if signature is valid
 */
async function verifySignature(username, signature, nonce) {
    if (!username) {
        throw new Error('Username is required for signature verification');
    }
    if (!signature) {
        throw new Error('Signature is required for signature verification');
    }
    if (!nonce) {
        throw new Error('Nonce is required for signature verification - the signature must be created by signing this nonce');
    }

    const cleanUsername = username.trim();
    
    // Get the mail_box_indexer URL from configuration
    const indexerUrl = config.mailBoxIndexerUrl || process.env.MAIL_BOX_INDEXER_URL || 'http://localhost:42069';
    
    try {
        // Determine if we need to resolve a name to an address
        let addressToVerify = cleanUsername;
        
        if (isENSName(cleanUsername)) {
            // For ENS names, resolve to owner address and verify
            const ownerAddress = await resolveENSOwner(cleanUsername);
            if (!ownerAddress) {
                throw new Error(`ENS name resolution failed: Could not resolve ${cleanUsername} to an owner address. The ENS name may not exist or may not have an owner set.`);
            }
            addressToVerify = ownerAddress;
        } else if (isSNSName(cleanUsername)) {
            // For SNS names, resolve to owner address and verify
            const ownerAddress = await resolveSNSOwner(cleanUsername);
            if (!ownerAddress) {
                throw new Error(`SNS name resolution failed: Could not resolve ${cleanUsername} to an owner address. The SNS name may not exist or may not have an owner set.`);
            }
            addressToVerify = ownerAddress;
        }

        // Call the mail_box_indexer's /verify endpoint
        const response = await axios.post(`${indexerUrl}/verify`, {
            walletAddress: addressToVerify,
            signature,
            message: nonce
        }, {
            timeout: 10000, // 10 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Check if the verification was successful
        if (response.data && typeof response.data.isValid === 'boolean') {
            return response.data.isValid;
        } else {
            throw new Error(`Invalid response format from mail_box_indexer: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        // Handle axios network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error(`Mail box indexer service unavailable at ${indexerUrl}. Please ensure the service is running.`);
        } else if (error.response) {
            // Server responded with error status
            const errorMessage = error.response.data?.error || `HTTP ${error.response.status}: ${error.response.statusText}`;
            throw new Error(`Signature verification failed: ${errorMessage}`);
        } else if (error.request) {
            // Network error
            throw new Error(`Network error while connecting to mail box indexer: ${error.message}`);
        } else {
            // Re-throw existing validation errors or other errors
            throw error;
        }
    }
}

/**
 * Verifies an EVM (Ethereum) signature - now delegates to mail_box_indexer
 * @param {String} addressOrBase64 - EVM address or base64-encoded address
 * @param {String} signature - The signature in base64 or hex format
 * @param {String} nonce - The nonce that was signed
 * @returns {Promise<Boolean>} - True if signature is valid
 */
async function verifyEVMSignature(addressOrBase64, signature, nonce) {
    // Handle base64-encoded addresses by decoding them first
    let address = addressOrBase64;
    if (isBase64EVMAddress(addressOrBase64)) {
        const decoded = Buffer.from(addressOrBase64, 'base64').toString('hex');
        address = '0x' + decoded;
    }
    
    return verifySignature(address, signature, nonce);
}

/**
 * Verifies a Solana signature - now delegates to mail_box_indexer
 * @param {String} address - Solana public key address
 * @param {String} signature - The signature in base58 format
 * @param {String} nonce - The nonce that was signed
 * @returns {Promise<Boolean>} - True if signature is valid
 */
async function verifySolanaSignature(address, signature, nonce) {
    return verifySignature(address, signature, nonce);
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

// Helper functions for address validation
function isEVMAddress(address) {
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    return evmRegex.test(address);
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
        return base58Regex.test(address);
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