'use strict';

const { isAddress, getAddress } = require('viem');
const { PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');

/**
 * Validates if a username is a valid blockchain address or name
 * @param {String} username - The username to validate (without domain part)
 * @returns {Boolean} - True if valid blockchain address/name, false otherwise
 */
function isValidBlockchainIdentifier(username) {
    if (!username || typeof username !== 'string') {
        return false;
    }

    // Remove any whitespace and convert to lowercase for ENS/SNS checks
    const cleanUsername = username.trim();
    const lowerUsername = cleanUsername.toLowerCase();

    // 1. Check if it's an EVM address (Ethereum, BSC, Polygon, etc.)
    if (isEVMAddress(cleanUsername)) {
        return true;
    }

    // 2. Check if it's a Solana address
    if (isSolanaAddress(cleanUsername)) {
        return true;
    }

    // 3. Check if it's an ENS name (.eth or .box) - use original case
    if (isENSName(cleanUsername)) {
        return true;
    }

    // 4. Check if it's an SNS name (.sol) - use original case
    if (isSNSName(cleanUsername)) {
        return true;
    }

    return false;
}

/**
 * Validates if a string is a valid EVM address
 * @param {String} address - The address to validate
 * @returns {Boolean} - True if valid EVM address
 */
function isEVMAddress(address) {
    try {
        // viem's isAddress validates EVM address format and checksum
        // Returns true for valid addresses (lowercase or properly checksummed)
        // Returns false for invalid addresses or incorrect checksums
        return isAddress(address);
    } catch (err) {
        return false;
    }
}

/**
 * Validates if a string is a valid Solana address
 * @param {String} address - The address to validate
 * @returns {Boolean} - True if valid Solana address
 */
function isSolanaAddress(address) {
    try {
        // Solana addresses are base58 encoded and typically 32-44 characters
        if (!address || typeof address !== 'string' || address.length < 32 || address.length > 44) {
            return false;
        }

        // Check if it's valid base58 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(address)) {
            return false;
        }

        // Try to decode as base58 and check length
        const decoded = bs58.decode(address);
        if (decoded.length !== 32) {
            return false;
        }

        // Try to create a PublicKey object as final validation
        new PublicKey(address);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Validates if a string is a valid ENS name
 * @param {String} name - The name to validate
 * @returns {Boolean} - True if valid ENS name
 */
function isENSName(name) {
    // ENS names must end with .eth or .box
    // They can have subdomains (e.g., subdomain.example.eth)
    // Convert to lowercase for validation
    
    const lowerName = name.toLowerCase();
    
    if (!lowerName.endsWith('.eth') && !lowerName.endsWith('.box')) {
        return false;
    }

    // Remove the TLD to validate the rest
    const withoutTLD = lowerName.endsWith('.eth') 
        ? lowerName.slice(0, -4) 
        : lowerName.slice(0, -4);

    // ENS name validation rules:
    // - Can contain lowercase letters, numbers, and hyphens
    // - Cannot start or end with a hyphen
    // - Cannot have consecutive hyphens
    // - Each label must be at least 1 character
    // - Can have multiple levels (subdomains)
    
    if (withoutTLD.length === 0) {
        return false;
    }

    const labels = withoutTLD.split('.');
    const validLabelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

    for (const label of labels) {
        if (label.length === 0 || !validLabelRegex.test(label)) {
            return false;
        }
        // Check for consecutive hyphens
        if (label.includes('--')) {
            return false;
        }
    }

    return true;
}

/**
 * Validates if a string is a valid SNS (Solana Name Service) name
 * @param {String} name - The name to validate
 * @returns {Boolean} - True if valid SNS name
 */
function isSNSName(name) {
    // SNS names must end with .sol
    // Similar rules to ENS but for Solana
    // Convert to lowercase for validation
    
    const lowerName = name.toLowerCase();
    
    if (!lowerName.endsWith('.sol')) {
        return false;
    }

    // Remove the .sol TLD to validate the rest
    const withoutTLD = lowerName.slice(0, -4);

    // SNS name validation rules (similar to ENS):
    // - Can contain lowercase letters, numbers, and hyphens
    // - Cannot start or end with a hyphen
    // - Each label must be at least 1 character
    // - Can have multiple levels (subdomains)
    
    if (withoutTLD.length === 0) {
        return false;
    }

    const labels = withoutTLD.split('.');
    const validLabelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

    for (const label of labels) {
        if (label.length === 0 || !validLabelRegex.test(label)) {
            return false;
        }
        // Check for consecutive hyphens
        if (label.includes('--')) {
            return false;
        }
    }

    return true;
}

module.exports = {
    isValidBlockchainIdentifier,
    isEVMAddress,
    isSolanaAddress,
    isENSName,
    isSNSName
};