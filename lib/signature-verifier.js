'use strict';

const config = require('wild-config');
const axios = require('axios');
const env = require('./env-loader');
const { resolveENSOwner, resolveSNSOwner } = require('./name-resolver');

/**
 * Verifies a signature for blockchain-based authentication using mail_box_indexer service
 * @param {String} username - The username (address or name)
 * @param {String} signature - The signature to verify
 * @param {String} message - The nonce that was signed (required for cryptographic verification)
 * @returns {Promise<Boolean>} - True if signature is valid
 */
async function verifySignature(username, signature, message) {
    if (!username) {
        throw new Error('Username is required for signature verification');
    }
    if (!signature) {
        throw new Error('Signature is required for signature verification');
    }
    if (!message) {
        throw new Error('Message is required for signature verification - the signature must be created by signing this message');
    }

    const cleanUsername = username.trim();
    
    // Get the mail_box_indexer URL from configuration with fallback support
    const indexerUrl = config.mailBoxIndexerUrl || env.get('MAIL_BOX_INDEXER_URL', 'http://localhost:42069');
    
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
            message
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
    verifySignature
};