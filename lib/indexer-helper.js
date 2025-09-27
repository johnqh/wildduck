'use strict';

const config = require('wild-config');
const https = require('https');
const http = require('http');

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

        return new Promise((resolve, reject) => {
            const url = new URL('/api/authenticate', indexerBaseUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            const postData = JSON.stringify(authData);

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 10000 // 10 second timeout
            };

            const req = client.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode === 200 && response.success) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (err) {
                        resolve(false);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('Indexer authentication request failed:', err.message);
                resolve(false);
            });

            req.on('timeout', () => {
                console.error('Indexer authentication request timed out');
                req.destroy();
                resolve(false);
            });

            req.write(postData);
            req.end();
        });
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
}

module.exports = IndexerHelper;