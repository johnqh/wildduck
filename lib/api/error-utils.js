'use strict';

/**
 * Enhanced error handling utilities for API responses
 */

/**
 * Get detailed error message for better API responses
 */
function getDetailedErrorMessage(code, message) {
    const errorDetails = {
        // Authentication errors
        'InvalidBlockchainIdentifier': 'The provided username is not a valid blockchain identifier. Please use a valid EVM address, ENS name, Solana address, or SNS name.',
        'BlockchainAddressNotFound': 'Unable to resolve the blockchain address. Please ensure the ENS/SNS name is valid and properly configured.',
        'AuthFailed': 'Authentication failed. Please verify your signature and credentials.',
        'PreAuthFailed': 'Pre-authentication check failed. Please verify your identifier.',
        'RateLimited': 'Too many authentication attempts. Please wait before trying again.',
        'RateLimitedError': 'Too many authentication attempts. Please wait before trying again.',
        'UserNotFound': 'No user account found for the provided identifier.',
        'UserDisabled': 'The user account has been disabled.',
        'UserSuspended': 'The user account has been suspended.',
        'InvalidAuthScope': 'Access to the requested service has been disabled for this user.',
        'NonceReused': 'The provided nonce has already been used. Please generate a new signature with a fresh nonce.',
        'SignatureVerificationFailed': 'The provided signature could not be verified. Please ensure you signed the correct message.',
        'TokenGenerationFailed': 'Failed to generate access token after successful authentication.',
        
        // Database errors
        'InternalDatabaseError': 'A database error occurred while processing your request. Please try again later.',
        'DuplicateError': 'The resource already exists. Please use a different identifier.',
        'NotFoundError': 'The requested resource was not found.',
        
        // Validation errors
        'InputValidationError': 'The provided input is invalid. Please check your request data.',
        'MissingParameterError': 'Required parameters are missing from your request.',
        'InvalidParameterError': 'One or more parameters have invalid values.',
        
        // Permission errors
        'AccessDenied': 'You do not have permission to perform this action.',
        'InsufficientPermissions': 'Your account lacks the necessary permissions for this operation.',
        
        // Resource errors
        'QuotaExceeded': 'You have exceeded your allowed quota for this resource.',
        'ResourceLimitReached': 'The maximum number of resources has been reached.',
        
        // General errors
        'ServiceUnavailable': 'The service is temporarily unavailable. Please try again later.',
        'TimeoutError': 'The request timed out. Please try again.',
        'ConfigurationError': 'A server configuration error occurred.'
    };

    return errorDetails[code] || message || 'An unexpected error occurred.';
}

/**
 * Get appropriate HTTP status code for error
 */
function getErrorStatusCode(code) {
    const statusCodes = {
        // Authentication errors (401/403)
        'AuthFailed': 403,
        'PreAuthFailed': 403,
        'InvalidAuthScope': 403,
        'UserDisabled': 403,
        'UserSuspended': 403,
        'AccessDenied': 403,
        'InsufficientPermissions': 403,
        'SignatureVerificationFailed': 403,
        
        // Client errors (400)
        'InputValidationError': 400,
        'InvalidBlockchainIdentifier': 400,
        'BlockchainAddressNotFound': 400,
        'MissingParameterError': 400,
        'InvalidParameterError': 400,
        'DuplicateError': 409,
        
        // Not found (404)
        'UserNotFound': 404,
        'NotFoundError': 404,
        
        // Rate limiting (429)
        'RateLimited': 429,
        'RateLimitedError': 429,
        'QuotaExceeded': 429,
        'ResourceLimitReached': 429,
        
        // Server errors (500)
        'InternalDatabaseError': 500,
        'TokenGenerationFailed': 500,
        'ServiceUnavailable': 503,
        'TimeoutError': 504,
        'ConfigurationError': 500
    };

    return statusCodes[code] || 500;
}

/**
 * Create standardized error response
 */
function createErrorResponse(error, additionalInfo = {}) {
    const code = error.code || 'UnknownError';
    const message = error.message || 'An error occurred';
    
    return {
        error: message,
        code,
        details: getDetailedErrorMessage(code, message),
        timestamp: new Date().toISOString(),
        ...additionalInfo
    };
}

/**
 * Send error response with proper status code
 */
function sendErrorResponse(res, error, additionalInfo = {}) {
    const response = createErrorResponse(error, additionalInfo);
    const statusCode = getErrorStatusCode(error.code);
    
    res.status(statusCode);
    return res.json(response);
}

module.exports = {
    getDetailedErrorMessage,
    getErrorStatusCode,
    createErrorResponse,
    sendErrorResponse
};