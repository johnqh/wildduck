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
            const response = await axios.post(`${indexerBaseUrl}/api/authenticate`, authData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000, // 10 second timeout
                validateStatus: status => status < 500 // Don't throw on 4xx errors
            });

            // Check if authentication was successful
            if (response.status === 200 && response.data && response.data.success) {
                return true;
            }

            // Authentication failed (not an error, just unsuccessful)
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
                    timeout: 10000, // 10 second timeout
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
}

module.exports = IndexerHelper;