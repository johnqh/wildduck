'use strict';

const fs = require('fs');
const path = require('path');
const config = require('wild-config');

// Log level enum
const LogLevel = {
    NONE: 'none',
    CONSOLE: 'console',
    FILE: 'file'
};

/**
 * Get current timestamp in yyyy_MM_dd format
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
}

/**
 * Get log file path based on current date
 * @returns {string} Log file path
 */
function getLogFilePath() {
    const timestamp = getTimestamp();
    const logsDir = path.join(__dirname, '..', 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    return path.join(logsDir, `log_${timestamp}.txt`);
}

/**
 * Format log message with timestamp
 * @param {...any} args - Arguments to log
 * @returns {string} Formatted log message
 */
function formatLogMessage(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    }).join(' ');

    return `[${timestamp}] ${message}\n`;
}

/**
 * Custom log function that respects the configured log level
 * @param {...any} args - Arguments to log (same as console.log)
 */
function log(...args) {
    const logLevel = config.api?.logLevel || LogLevel.CONSOLE;

    switch (logLevel) {
        case LogLevel.NONE:
            // Do nothing
            break;

        case LogLevel.CONSOLE:
            console.log(...args);
            break;

        case LogLevel.FILE:
            try {
                const logMessage = formatLogMessage(...args);
                const logFilePath = getLogFilePath();
                fs.appendFileSync(logFilePath, logMessage, 'utf8');
            } catch (err) {
                // Fallback to console if file logging fails
                console.error('Failed to write to log file:', err.message);
                console.log(...args);
            }
            break;

        default:
            // Default to console logging for unknown log levels
            console.log(...args);
            break;
    }
}

/**
 * Enhanced logging functions for different contexts
 */

/**
 * Log API endpoint activity with structured metadata
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint path
 * @param {Object} metadata - Additional context (userId, requestId, etc.)
 * @param {string} message - Log message
 * @param {Object} [data] - Optional data to include
 */
function logAPI(method, endpoint, metadata = {}, message, data = null) {
    const logEntry = {
        type: 'API',
        method,
        endpoint,
        timestamp: new Date().toISOString(),
        ...metadata,
        message
    };

    if (data) {
        logEntry.data = data;
    }

    log(`[API] ${method} ${endpoint}`, logEntry, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log IMAP command activity with session context
 * @param {string} command - IMAP command (COPY, FETCH, etc.)
 * @param {Object} session - IMAP session object
 * @param {string} message - Log message
 * @param {Object} [data] - Optional data to include
 */
function logIMAP(command, session, message, data = null) {
    const logEntry = {
        type: 'IMAP',
        command,
        sessionId: session?.id,
        userId: session?.user?.id,
        clientId: session?.clientId,
        timestamp: new Date().toISOString(),
        message
    };

    if (data) {
        logEntry.data = data;
    }

    log(`[IMAP] ${command} [${session?.id}]`, logEntry, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log test execution with test context
 * @param {string} testName - Name of the test
 * @param {string} testSuite - Test suite name
 * @param {string} status - Test status (START, PASS, FAIL, SKIP)
 * @param {string} message - Log message
 * @param {Object} [data] - Optional test data
 */
function logTest(testName, testSuite, status, message, data = null) {
    const logEntry = {
        type: 'TEST',
        testName,
        testSuite,
        status,
        timestamp: new Date().toISOString(),
        message
    };

    if (data) {
        logEntry.data = data;
    }

    log(`[TEST] ${status} ${testSuite}::${testName}`, logEntry, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log database operations with timing
 * @param {string} operation - Database operation (find, insert, update, etc.)
 * @param {string} collection - Collection name
 * @param {Object} metadata - Additional context
 * @param {string} message - Log message
 * @param {Object} [data] - Optional query/result data
 */
function logDB(operation, collection, metadata = {}, message, data = null) {
    const logEntry = {
        type: 'DB',
        operation,
        collection,
        timestamp: new Date().toISOString(),
        ...metadata,
        message
    };

    if (data) {
        logEntry.data = data;
    }

    log(`[DB] ${operation} ${collection}`, logEntry, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log errors with stack traces and context
 * @param {Error} error - Error object
 * @param {Object} context - Context where error occurred
 * @param {string} [additionalMessage] - Additional error context
 */
function logError(error, context = {}, additionalMessage = '') {
    const logEntry = {
        type: 'ERROR',
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        context,
        additionalMessage,
        timestamp: new Date().toISOString()
    };

    log(`[ERROR] ${error.name}: ${error.message}`, logEntry, additionalMessage);
}

/**
 * Log performance metrics and timing
 * @param {string} operation - Operation being measured
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional context
 * @param {string} [message] - Optional message
 */
function logPerformance(operation, duration, metadata = {}, message = '') {
    const logEntry = {
        type: 'PERFORMANCE',
        operation,
        duration,
        timestamp: new Date().toISOString(),
        ...metadata,
        message
    };

    log(`[PERF] ${operation} took ${duration}ms`, logEntry, message);
}

module.exports = {
    LogLevel,
    log,
    logAPI,
    logIMAP,
    logTest,
    logDB,
    logError,
    logPerformance
};