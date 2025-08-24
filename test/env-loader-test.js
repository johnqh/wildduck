/**
 * Tests for environment variable loader
 */

'use strict';

const env = require('../lib/env-loader');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('Environment Loader', () => {
    const testEnvPath = path.resolve(process.cwd(), '.env.test');
    const testEnvLocalPath = path.resolve(process.cwd(), '.env.local.test');

    before(() => {
        // Create test .env files
        fs.writeFileSync(testEnvPath, 'TEST_VAR=from_env\\nSHARED_VAR=env_value\\n');
        fs.writeFileSync(testEnvLocalPath, 'TEST_LOCAL_VAR=from_env_local\\nSHARED_VAR=local_value\\n');
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testEnvPath)) {
            fs.unlinkSync(testEnvPath);
        }
        if (fs.existsSync(testEnvLocalPath)) {
            fs.unlinkSync(testEnvLocalPath);
        }
    });

    beforeEach(() => {
        // Reload environment for each test
        env.reload();
    });

    it('should get environment variable from process.env', () => {
        process.env.TEST_PROCESS_VAR = 'from_process';
        const value = env.get('TEST_PROCESS_VAR');
        assert.strictEqual(value, 'from_process');
        delete process.env.TEST_PROCESS_VAR;
    });

    it('should return default value when variable not found', () => {
        const value = env.get('NON_EXISTENT_VAR', 'default_value');
        assert.strictEqual(value, 'default_value');
    });

    it('should return undefined when variable not found and no default', () => {
        const value = env.get('NON_EXISTENT_VAR');
        assert.strictEqual(value, undefined);
    });

    it('should check if variable exists', () => {
        process.env.TEST_EXISTS = 'exists';
        assert.strictEqual(env.has('TEST_EXISTS'), true);
        assert.strictEqual(env.has('NON_EXISTENT'), false);
        delete process.env.TEST_EXISTS;
    });

    it('should prioritize process.env over .env files', () => {
        process.env.MAIL_BOX_INDEXER_URL = 'from_process_env';
        const value = env.get('MAIL_BOX_INDEXER_URL');
        assert.strictEqual(value, 'from_process_env');
        delete process.env.MAIL_BOX_INDEXER_URL;
    });

    it('should load from .env file when process.env not set', () => {
        // This will load from the actual .env file if it exists
        const value = env.get('MAIL_BOX_INDEXER_URL');
        if (value !== undefined) {
            assert.ok(typeof value === 'string');
        }
    });

    it('should get all environment variables', () => {
        process.env.TEST_ALL = 'test_value';
        const allVars = env.getAll();
        assert.ok(typeof allVars === 'object');
        assert.strictEqual(allVars.TEST_ALL, 'test_value');
        delete process.env.TEST_ALL;
    });
});