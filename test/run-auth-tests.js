#!/usr/bin/env node
'use strict';

/**
 * Test Runner for Authentication Tests
 * 
 * This script runs all authentication tests across API and protocol layers.
 * It provides options to run specific test suites or all tests.
 * 
 * Usage:
 *   node test/run-auth-tests.js [options]
 * 
 * Options:
 *   --api     Run only API authentication tests
 *   --imap    Run only IMAP protocol tests
 *   --pop3    Run only POP3 protocol tests
 *   --smtp    Run only SMTP protocol tests
 *   --all     Run all authentication tests (default)
 *   --help    Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
    timeout: 30000,
    reporter: 'spec',
    recursive: true,
    exit: true
};

// Available test suites
const TEST_SUITES = {
    api: {
        name: 'API Authentication Tests',
        path: 'test/api/authentication-test.js',
        description: 'Tests the REST API /authenticate endpoint with blockchain signatures'
    },
    imap: {
        name: 'IMAP Protocol Tests',
        path: 'test/protocol/imap-auth-test.js',
        description: 'Tests IMAP LOGIN command with blockchain authentication'
    },
    pop3: {
        name: 'POP3 Protocol Tests', 
        path: 'test/protocol/pop3-auth-test.js',
        description: 'Tests POP3 USER/PASS commands with blockchain authentication'
    },
    smtp: {
        name: 'SMTP Protocol Tests',
        path: 'test/protocol/smtp-auth-test.js',
        description: 'Tests SMTP/LMTP protocol compatibility and future auth support'
    },
    helpers: {
        name: 'Test Utilities',
        path: 'test/helpers/auth-test-utils.js',
        description: 'Authentication test utilities and mock data'
    }
};

function showHelp() {
    console.log(`
WildDuck Authentication Test Runner

Usage: node test/run-auth-tests.js [options]

Options:
  --api      Run only API authentication tests
  --imap     Run only IMAP protocol tests  
  --pop3     Run only POP3 protocol tests
  --smtp     Run only SMTP protocol tests
  --all      Run all authentication tests (default)
  --list     List available test suites
  --help     Show this help message

Test Suites:
`);
    
    Object.entries(TEST_SUITES).forEach(([key, suite]) => {
        console.log(`  ${key.padEnd(8)} ${suite.name}`);
        console.log(`           ${suite.description}`);
        console.log('');
    });
    
    console.log(`
Examples:
  node test/run-auth-tests.js --api     # Run only API tests
  node test/run-auth-tests.js --imap    # Run only IMAP tests
  node test/run-auth-tests.js --all     # Run all tests
  node test/run-auth-tests.js           # Run all tests (default)

Prerequisites:
  - WildDuck server must be running (API, IMAP, POP3, LMTP)
  - MongoDB and Redis must be accessible
  - Test environment should be configured
`);
}

function listTestSuites() {
    console.log('\nAvailable Test Suites:\n');
    
    Object.entries(TEST_SUITES).forEach(([key, suite]) => {
        const exists = fs.existsSync(suite.path);
        const status = exists ? '✓' : '✗';
        
        console.log(`${status} ${key.padEnd(10)} ${suite.name}`);
        console.log(`   Path: ${suite.path}`);
        console.log(`   Desc: ${suite.description}`);
        console.log('');
    });
}

function runTests(suites) {
    console.log(`\n🧪 Running Authentication Tests...\n`);
    
    const testPaths = suites.map(suite => TEST_SUITES[suite].path);
    const mochaBin = path.join(__dirname, '../node_modules/.bin/mocha');
    
    // Check if mocha exists
    if (!fs.existsSync(mochaBin)) {
        console.error('❌ Mocha not found. Please run: npm install');
        process.exit(1);
    }
    
    // Build mocha command arguments
    const args = [
        '--timeout', TEST_CONFIG.timeout.toString(),
        '--reporter', TEST_CONFIG.reporter,
        '--exit'
    ].concat(testPaths);
    
    console.log(`📋 Test Plan:`);
    suites.forEach(suite => {
        console.log(`   • ${TEST_SUITES[suite].name}`);
    });
    console.log('');
    
    // Run mocha
    const mocha = spawn(mochaBin, args, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    
    mocha.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ All authentication tests passed!');
        } else {
            console.log(`\n❌ Tests failed with exit code ${code}`);
        }
        process.exit(code);
    });
    
    mocha.on('error', (err) => {
        console.error('❌ Failed to run tests:', err.message);
        process.exit(1);
    });
}

function validateTestFiles(suites) {
    const missing = [];
    
    suites.forEach(suite => {
        if (!fs.existsSync(TEST_SUITES[suite].path)) {
            missing.push(`${suite}: ${TEST_SUITES[suite].path}`);
        }
    });
    
    if (missing.length > 0) {
        console.error('❌ Missing test files:');
        missing.forEach(file => console.error(`   ${file}`));
        console.error('\nPlease ensure all test files are created.');
        process.exit(1);
    }
}

function checkPrerequisites() {
    // Check if we're in the right directory
    if (!fs.existsSync('package.json')) {
        console.error('❌ Please run this script from the WildDuck root directory');
        process.exit(1);
    }
    
    // Check if dependencies are installed
    if (!fs.existsSync('node_modules')) {
        console.error('❌ Dependencies not installed. Please run: npm install');
        process.exit(1);
    }
    
    console.log('✅ Prerequisites check passed');
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        suites: [],
        help: false,
        list: false
    };
    
    args.forEach(arg => {
        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
            case '--list':
            case '-l':
                options.list = true;
                break;
            case '--api':
                options.suites.push('api');
                break;
            case '--imap':
                options.suites.push('imap');
                break;
            case '--pop3':
                options.suites.push('pop3');
                break;
            case '--smtp':
                options.suites.push('smtp');
                break;
            case '--all':
                options.suites = ['api', 'imap', 'pop3', 'smtp'];
                break;
            default:
                if (arg.startsWith('--')) {
                    console.error(`❌ Unknown option: ${arg}`);
                    showHelp();
                    process.exit(1);
                }
        }
    });
    
    // Default to all tests if no specific suites selected
    if (options.suites.length === 0 && !options.help && !options.list) {
        options.suites = ['api', 'imap', 'pop3', 'smtp'];
    }
    
    return options;
}

// Main execution
function main() {
    const options = parseArgs();
    
    if (options.help) {
        showHelp();
        process.exit(0);
    }
    
    if (options.list) {
        listTestSuites();
        process.exit(0);
    }
    
    console.log('🐦 WildDuck Authentication Test Runner');
    console.log('====================================');
    
    checkPrerequisites();
    validateTestFiles(options.suites);
    runTests(options.suites);
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    TEST_SUITES,
    runTests,
    parseArgs,
    checkPrerequisites
};