'use strict';

const { createPublicClient, http, getAddress, isAddress: viemIsAddress } = require('viem');
const { mainnet, optimism } = require('viem/chains');
const { createEnsPublicClient } = require('@ensdomains/ensjs');
const { Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');

/**
 * Resolves ENS name to owner address using official ENSjs library
 * @param {String} ensName - The ENS name (e.g., 'vitalik.eth', 'example.box')
 * @param {String} ethRpcUrl - Ethereum RPC URL (optional, defaults to public RPC)
 * @param {String} opRpcUrl - Optimism RPC URL (optional, defaults to public RPC)
 * @returns {Promise<String>} - The owner address or null if not found
 */
async function resolveENSOwner(ensName, ethRpcUrl = 'https://eth.llamarpc.com', opRpcUrl = 'https://mainnet.optimism.io') {
    try {
        // For .box domains, .box domains are integrated with ENS but may use special resolvers
        // Currently ENSjs doesn't support Optimism chain directly, so we'll try mainnet first
        // This is because .box domains integrate with ENS on mainnet via cross-chain resolvers
        const client = createEnsPublicClient({
            chain: mainnet,
            transport: http(ethRpcUrl)
        });

        // Get the owner using ENSjs getOwner function
        const ownerResult = await client.getOwner({ name: ensName });

        // Check if owner is valid (not zero address)
        if (!ownerResult || !ownerResult.owner || ownerResult.owner === '0x0000000000000000000000000000000000000000') {
            return null;
        }

        return getAddress(ownerResult.owner);
    } catch (err) {
        console.error('ENS resolution error:', err);
        return null;
    }
}

/**
 * Resolves ENS name to the address it points to (not the owner) using official ENSjs library
 * @param {String} ensName - The ENS name (e.g., 'vitalik.eth', 'example.box')
 * @param {String} ethRpcUrl - Ethereum RPC URL (optional, defaults to public RPC)
 * @param {String} opRpcUrl - Optimism RPC URL (optional, defaults to public RPC)
 * @returns {Promise<String>} - The resolved address or null if not found
 */
async function resolveENSAddress(ensName, ethRpcUrl = 'https://eth.llamarpc.com', opRpcUrl = 'https://mainnet.optimism.io') {
    try {
        // For .box domains, they are integrated with ENS via cross-chain resolvers
        // Currently ENSjs doesn't support Optimism chain directly, so we'll use mainnet
        const client = createEnsPublicClient({
            chain: mainnet,
            transport: http(ethRpcUrl)
        });

        // Get the resolved address using ENSjs getAddressRecord function
        const addressResult = await client.getAddressRecord({ name: ensName });

        // Check if address is valid (not zero address)
        if (!addressResult || !addressResult.value || addressResult.value === '0x0000000000000000000000000000000000000000') {
            return null;
        }

        return getAddress(addressResult.value);
    } catch (err) {
        console.error('ENS address resolution error:', err);
        return null;
    }
}

/**
 * Resolves SNS name to owner address
 * @param {String} snsName - The SNS name (e.g., 'bonfida.sol')
 * @param {String} rpcUrl - Solana RPC URL (optional, defaults to mainnet)
 * @returns {Promise<String>} - The owner address or null if not found
 */
async function resolveSNSOwner(snsName, rpcUrl = 'https://api.mainnet-beta.solana.com') {
    try {
        // Remove .sol extension
        const domainName = snsName.endsWith('.sol') ? snsName.slice(0, -4) : snsName;

        // Create Solana connection
        const connection = new Connection(rpcUrl);

        // SNS Name Registry Program ID
        const NAME_PROGRAM_ID = new PublicKey('namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX');

        // Hash the domain name
        const hashedName = await hashName(domainName);
        
        // Derive the name account key
        const nameAccountKey = await getNameAccountKey(hashedName, undefined, NAME_PROGRAM_ID);

        // Get the name account info
        const nameAccount = await connection.getAccountInfo(nameAccountKey);
        
        if (!nameAccount) {
            return null;
        }

        // Parse the name registry state (simple parsing)
        // SNS name accounts store the owner in the first 32 bytes after a header
        if (nameAccount.data.length >= 96) {
            const ownerBytes = nameAccount.data.slice(32, 64);
            const owner = new PublicKey(ownerBytes);
            return owner.toString();
        }

        return null;
    } catch (err) {
        console.error('SNS resolution error:', err);
        return null;
    }
}

/**
 * Hash a domain name for SNS
 * @param {String} name - Domain name to hash
 * @returns {Promise<Buffer>} - Hashed name
 */
const crypto = require('crypto');

async function hashName(name) {
    return crypto.createHash('sha256').update(name).digest();
}

/**
 * Get name account key for SNS
 * @param {Buffer} hashedName - Hashed domain name
 * @param {PublicKey} nameClass - Name class (optional)
 * @param {PublicKey} programId - Name program ID
 * @returns {Promise<PublicKey>} - Name account key
 */
async function getNameAccountKey(hashedName, nameClass, programId) {
    const seeds = [hashedName];
    if (nameClass) {
        seeds.push(nameClass.toBytes());
    }
    
    const [nameAccountKey] = await PublicKey.findProgramAddress(seeds, programId);
    return nameAccountKey;
}

/**
 * Resolves a blockchain name to its owner address
 * @param {String} name - The blockchain name (ENS or SNS)
 * @param {Object} options - Optional configuration
 * @param {String} options.ethRpcUrl - Ethereum RPC URL
 * @param {String} options.opRpcUrl - Optimism RPC URL
 * @param {String} options.solRpcUrl - Solana RPC URL
 * @returns {Promise<String>} - The owner address or null if not found
 */
async function resolveNameOwner(name, options = {}) {
    const cleanName = name.trim().toLowerCase();
    
    if (cleanName.endsWith('.eth') || cleanName.endsWith('.box')) {
        return resolveENSOwner(cleanName, options.ethRpcUrl, options.opRpcUrl);
    } else if (cleanName.endsWith('.sol')) {
        return resolveSNSOwner(cleanName, options.solRpcUrl);
    }
    
    return null;
}

/**
 * Gets the actual address for authentication based on username type
 * @param {String} username - The username (address or name)
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} - Object with { address, type } or null if invalid
 */
async function getAuthenticationAddress(username, options = {}) {
    const cleanUsername = username.trim();
    
    // Direct EVM address
    if (isEVMAddress(cleanUsername)) {
        return { address: cleanUsername, type: 'evm' };
    }
    
    // Base64-encoded EVM address
    if (isBase64EVMAddress(cleanUsername)) {
        const decoded = Buffer.from(cleanUsername, 'base64').toString('hex');
        const address = '0x' + decoded;
        // Convert to proper checksum format using viem
        const checksumAddress = viemIsAddress(address) ? getAddress(address) : null;
        if (!checksumAddress) {
            return null;
        }
        return { address: checksumAddress, type: 'evm' };
    }
    
    // Direct Solana address
    if (isSolanaAddress(cleanUsername)) {
        return { address: cleanUsername, type: 'solana' };
    }
    
    // ENS name - resolve to owner
    if (isENSName(cleanUsername)) {
        const owner = await resolveENSOwner(cleanUsername, options.ethRpcUrl, options.opRpcUrl);
        if (owner) {
            return { address: owner, type: 'evm' };
        }
    }
    
    // SNS name - resolve to owner
    if (isSNSName(cleanUsername)) {
        const owner = await resolveSNSOwner(cleanUsername, options.solRpcUrl);
        if (owner) {
            return { address: owner, type: 'solana' };
        }
    }
    
    return null;
}

// Helper functions
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
    resolveENSOwner,
    resolveENSAddress,
    resolveSNSOwner,
    resolveNameOwner,
    getAuthenticationAddress
};