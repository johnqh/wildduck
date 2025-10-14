'use strict';

const config = require('wild-config');
const axios = require('axios');

/**
 * IndexerHelper - Helper class for integrating with external indexer service
 */
class IndexerHelper {
    /**
     * Call the indexer's /api/authenticate endpoint
     * @param {Object} authData - Authentication data to send to indexer
     * @returns {Promise<boolean>} - True if indexer authentication succeeds
     */
    static async authenticate(authData) {
        const indexerBaseUrl = config.api.indexerBaseUrl;

        if (!indexerBaseUrl) {
            throw new Error('Indexer service not configured. indexerBaseUrl must be set in crypto emails mode');
        }

        try {
            console.log('IndexerHelper.authenticate - Sending request to:', `${indexerBaseUrl}/authenticate`);
            console.log('IndexerHelper.authenticate - Auth data:', JSON.stringify(authData, null, 2));

            const response = await axios.post(`${indexerBaseUrl}/authenticate`, authData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000, // 5 second timeout
                validateStatus: status => status < 500 // Don't throw on 4xx errors
            });

            console.log('IndexerHelper.authenticate - Response status:', response.status);
            console.log('IndexerHelper.authenticate - Response data:', JSON.stringify(response.data, null, 2));

            // Check if authentication was successful
            if (response.status === 200 && response.data && response.data.success) {
                console.log('IndexerHelper.authenticate - Authentication successful');
                return true;
            }

            // Authentication failed (not an error, just unsuccessful)
            console.log('IndexerHelper.authenticate - Authentication failed');
            return false;
        } catch (err) {
            // Handle different error types
            if (err.code === 'ECONNABORTED') {
                console.error('Indexer authentication request timed out');
                throw new Error('Indexer request timed out');
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                console.error('Indexer authentication request failed:', err.message);
                throw new Error(`Indexer connection failed: ${err.message}`);
            } else if (err.response) {
                // Server responded with 5xx error
                console.error('Indexer server error:', err.response.status);
                throw new Error(`Indexer server error: ${err.response.status}`);
            } else {
                // Other errors (network, parsing, etc.)
                console.error('Indexer authentication error:', err.message);
                throw new Error(`Indexer error: ${err.message}`);
            }
        }
    }

    /**
     * Check if indexer is configured for crypto emails mode
     * @returns {boolean} - True if indexer is properly configured
     */
    static isConfigured() {
        return !!config.api.indexerBaseUrl;
    }

    /**
     * Get the configured indexer base URL
     * @returns {string|undefined} - The indexer base URL or undefined if not configured
     */
    static getBaseUrl() {
        return config.api.indexerBaseUrl;
    }

    /**
     * Verify a signature with the indexer service
     * @param {string} address - The address to verify
     * @param {string} message - The message that was signed
     * @param {string} signature - The signature to verify
     * @returns {Promise<boolean>} - True if signature is valid
     */
    static async verify(address, message, signature) {
        const indexerBaseUrl = config.api.indexerBaseUrl;

        if (!indexerBaseUrl) {
            throw new Error('Indexer service not configured. indexerBaseUrl must be set');
        }

        try {
            // The indexer expects message and signature in headers
            const response = await axios.post(
                `${indexerBaseUrl}/api/addresses/${encodeURIComponent(address)}/verify`,
                {}, // Empty body - the indexer uses headers
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-message': encodeURIComponent(message),
                        'x-signature': signature
                    },
                    timeout: 5000, // 5 second timeout
                    validateStatus: status => status < 500 // Don't throw on 4xx errors
                }
            );

            // The indexer returns { success: boolean }
            if (response.status === 200 && response.data && response.data.success === true) {
                return true;
            }

            // Verification failed
            return false;
        } catch (err) {
            // Handle different error types
            if (err.code === 'ECONNABORTED') {
                console.error('Indexer verification request timed out');
                throw new Error('Indexer request timed out');
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                console.error('Indexer verification request failed:', err.message);
                throw new Error(`Indexer connection failed: ${err.message}`);
            } else if (err.response) {
                // Server responded with 5xx error
                console.error('Indexer server error:', err.response.status);
                throw new Error(`Indexer server error: ${err.response.status}`);
            } else {
                // Other errors (network, parsing, etc.)
                console.error('Indexer verification error:', err.message);
                throw new Error(`Indexer error: ${err.message}`);
            }
        }
    }

    /**
     * Award reward points for an email action
     * @param {string} walletAddress - The wallet address to reward
     * @param {string} action - The reward action type (send, forward, reply)
     * @returns {Promise<boolean>} - True if reward was successfully added, false otherwise
     */
    static async addRewardPoints(walletAddress, action) {
        const indexerBaseUrl = config.api.indexerBaseUrl;

        // If indexer is not configured, silently skip (don't fail email operations)
        if (!indexerBaseUrl) {
            console.log('IndexerHelper.addRewardPoints - Indexer not configured, skipping reward');
            return false;
        }

        // Validate action
        const validActions = ['send', 'forward', 'reply'];
        if (!validActions.includes(action)) {
            console.warn(`IndexerHelper.addRewardPoints - Invalid action: ${action}`);
            return false;
        }

        try {
            console.log(`IndexerHelper.addRewardPoints - Adding ${action} reward for wallet: ${walletAddress}`);

            const response = await axios.post(
                `${indexerBaseUrl}/api/wallets/${encodeURIComponent(walletAddress)}/points/add`,
                {
                    action
                    // referrer is intentionally omitted as per user requirements
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000, // 5 second timeout
                    validateStatus: status => status < 500 // Don't throw on 4xx errors
                }
            );

            console.log('IndexerHelper.addRewardPoints - Response status:', response.status);
            console.log('IndexerHelper.addRewardPoints - Response data:', JSON.stringify(response.data, null, 2));

            // Check if reward was successfully added
            if (response.status === 200 && response.data && response.data.success) {
                console.log(`IndexerHelper.addRewardPoints - Successfully added ${action} reward for ${walletAddress}`);
                return true;
            }

            // Reward failed (e.g., rate limited, invalid action)
            console.log(`IndexerHelper.addRewardPoints - Reward not added: ${response.data?.error || 'Unknown reason'}`);
            return false;
        } catch (err) {
            // Log error but don't throw - we don't want to fail email operations if reward fails
            if (err.code === 'ECONNABORTED') {
                console.error('IndexerHelper.addRewardPoints - Request timed out');
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                console.error('IndexerHelper.addRewardPoints - Connection failed:', err.message);
            } else if (err.response) {
                console.error('IndexerHelper.addRewardPoints - Server error:', err.response.status);
            } else {
                console.error('IndexerHelper.addRewardPoints - Error:', err.message);
            }
            return false;
        }
    }
}

module.exports = IndexerHelper;