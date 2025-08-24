/**
 * Environment Variable Loader
 * 
 * Provides a unified way to load environment variables with fallback support:
 * 1. Check process.env (highest priority)
 * 2. Check .env file
 * 3. Check .env.local file (fallback)
 * 
 * Usage:
 *   const env = require('./lib/env-loader');
 *   const value = env.get('VARIABLE_NAME', 'default_value');
 */

'use strict';

const fs = require('fs');
const path = require('path');

class EnvironmentLoader {
    constructor() {
        this.envVars = new Map();
        this.loaded = false;
    }

    /**
     * Load environment variables from .env and .env.local files
     * @private
     */
    _loadEnvFiles() {
        if (this.loaded) {
            return;
        }

        // Load .env.local first (lower priority)
        this._loadEnvFile('.env.local');
        
        // Load .env second (higher priority, will override .env.local)
        this._loadEnvFile('.env');

        this.loaded = true;
    }

    /**
     * Load a specific .env file
     * @param {string} filename - The .env filename
     * @private
     */
    _loadEnvFile(filename) {
        const envPath = path.resolve(process.cwd(), filename);
        
        try {
            if (!fs.existsSync(envPath)) {
                return;
            }

            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\\n');

            for (const line of lines) {
                // Skip empty lines and comments
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    continue;
                }

                // Parse KEY=VALUE format
                const equalIndex = trimmed.indexOf('=');
                if (equalIndex === -1) {
                    continue;
                }

                const key = trimmed.substring(0, equalIndex).trim();
                let value = trimmed.substring(equalIndex + 1).trim();

                // Remove surrounding quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                // Only set if not already set (allows .env to override .env.local)
                if (!this.envVars.has(key)) {
                    this.envVars.set(key, value);
                }
            }
        } catch (error) {
            // Silently ignore file read errors
            // Environment files are optional
        }
    }

    /**
     * Get an environment variable with fallback support
     * @param {string} key - The environment variable name
     * @param {string} [defaultValue] - Default value if not found
     * @returns {string|undefined} The environment variable value
     */
    get(key, defaultValue) {
        // 1. Check process.env first (highest priority)
        if (process.env[key] !== undefined) {
            return process.env[key];
        }

        // 2. Load .env files if not already loaded
        this._loadEnvFiles();

        // 3. Check loaded .env files
        if (this.envVars.has(key)) {
            return this.envVars.get(key);
        }

        // 4. Return default value
        return defaultValue;
    }

    /**
     * Check if an environment variable exists
     * @param {string} key - The environment variable name
     * @returns {boolean} True if the variable exists
     */
    has(key) {
        if (process.env[key] !== undefined) {
            return true;
        }

        this._loadEnvFiles();
        return this.envVars.has(key);
    }

    /**
     * Get all environment variables as an object
     * @returns {Object} All environment variables
     */
    getAll() {
        this._loadEnvFiles();
        
        const allVars = {};
        
        // Add .env file variables
        for (const [key, value] of this.envVars.entries()) {
            allVars[key] = value;
        }

        // Override with process.env (higher priority)
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                allVars[key] = value;
            }
        }

        return allVars;
    }

    /**
     * Reload environment files (useful for testing)
     */
    reload() {
        this.envVars.clear();
        this.loaded = false;
        this._loadEnvFiles();
    }
}

// Export singleton instance
module.exports = new EnvironmentLoader();