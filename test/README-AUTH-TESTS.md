# WildDuck Authentication Tests

This directory contains comprehensive automated tests for WildDuck's blockchain-based authentication system.

## Overview

The authentication tests verify that WildDuck correctly handles blockchain signatures across all protocols:

- **API Tests**: REST API `/authenticate` endpoint
- **IMAP Tests**: IMAP LOGIN command with blockchain credentials  
- **POP3 Tests**: POP3 USER/PASS commands with blockchain credentials
- **SMTP Tests**: SMTP/LMTP protocol compatibility and future SMTP AUTH support

## Supported Authentication Types

- **EVM Addresses**: Ethereum-compatible addresses (0x...)
- **Solana Addresses**: Base58-encoded Solana public keys
- **ENS Names**: Ethereum Name Service domains (.eth)
- **SNS Names**: Solana Name Service domains (.sol)

## Test Structure

```
test/
├── api/
│   └── authentication-test.js     # API endpoint tests
├── protocol/
│   ├── imap-auth-test.js          # IMAP protocol tests
│   ├── pop3-auth-test.js          # POP3 protocol tests
│   └── smtp-auth-test.js          # SMTP protocol tests
├── helpers/
│   └── auth-test-utils.js         # Test utilities and mock wallets
├── run-auth-tests.js              # Test runner script
└── README-AUTH-TESTS.md           # This file
```

## Prerequisites

Before running authentication tests, ensure:

1. **WildDuck Server Running**: All protocol servers must be active
   ```bash
   npm start
   ```

2. **Dependencies Installed**: 
   ```bash
   npm install
   ```

3. **Database Access**: MongoDB and Redis must be accessible

4. **Test Environment**: Proper test configuration in place

## Running Tests

### Using NPM Scripts (Recommended)

```bash
# Run all authentication tests
npm run test:auth

# Run specific protocol tests
npm run test:auth:api     # API tests only
npm run test:auth:imap    # IMAP tests only
npm run test:auth:pop3    # POP3 tests only
npm run test:auth:smtp    # SMTP tests only
```

### Using Test Runner Directly

```bash
# All tests
node test/run-auth-tests.js

# Specific tests
node test/run-auth-tests.js --api
node test/run-auth-tests.js --imap
node test/run-auth-tests.js --pop3
node test/run-auth-tests.js --smtp

# Help and options
node test/run-auth-tests.js --help
node test/run-auth-tests.js --list
```

### Using Mocha Directly

```bash
# Individual test files
npx mocha test/api/authentication-test.js
npx mocha test/protocol/imap-auth-test.js
npx mocha test/protocol/pop3-auth-test.js
npx mocha test/protocol/smtp-auth-test.js

# All authentication tests
npx mocha test/**/*auth*test.js
```

## Test Categories

### API Authentication Tests (`test/api/authentication-test.js`)

Tests the REST API `/authenticate` endpoint:

- ✅ EVM wallet authentication with base64 signatures
- ✅ Solana wallet authentication with base58 signatures  
- ✅ ENS name authentication with owner verification
- ✅ SNS name authentication with owner verification
- ✅ Auto-user creation on first authentication
- ✅ Nonce management and replay attack prevention
- ✅ Scope-based access control (master, imap, pop3, smtp)
- ✅ Detailed error handling and status codes

### IMAP Protocol Tests (`test/protocol/imap-auth-test.js`)

Tests IMAP LOGIN command using raw socket connections:

- ✅ LOGIN command with blockchain addresses as usernames
- ✅ Signatures passed as passwords per IMAP standard
- ✅ CAPABILITY advertisement compliance (RFC 3501)
- ✅ STARTTLS support for secure authentication
- ✅ Session management and state handling
- ✅ Error handling for malformed commands
- ✅ Special character handling in credentials

### POP3 Protocol Tests (`test/protocol/pop3-auth-test.js`)

Tests POP3 USER/PASS commands using raw socket connections:

- ✅ USER/PASS sequence with blockchain credentials
- ✅ Protocol compliance per RFC 1939
- ✅ CAPA command capability discovery  
- ✅ STLS support for secure connections
- ✅ Session management after authentication
- ✅ Command rejection before authentication
- ✅ Error handling for protocol violations

### SMTP Protocol Tests (`test/protocol/smtp-auth-test.js`)

Tests SMTP/LMTP compatibility and future SMTP AUTH support:

- ✅ EHLO/LHLO capability discovery
- ✅ SMTP AUTH PLAIN simulation for blockchain auth
- ✅ SMTP AUTH LOGIN simulation  
- ✅ Protocol compliance per RFC 5321/4954
- ✅ STARTTLS security testing
- ✅ Future SMTP submission server preparation
- ✅ Scope-based authentication design

## Test Utilities (`test/helpers/auth-test-utils.js`)

Provides comprehensive testing infrastructure:

- **Mock Wallets**: Pre-configured test wallets for all blockchain types
- **Signature Generation**: Automated signature creation using real crypto libraries
- **Test Data Factory**: Creates valid authentication data for testing
- **Invalid Data Generator**: Creates invalid data for error testing
- **User Mocking**: MongoDB user document simulation

## Authentication Flow Testing

### Complete Flow Test Example

```javascript
// 1. Generate authentication data
const authData = await createAPIAuthData('evm');

// 2. Test API authentication
POST /authenticate {
  username: authData.username,    // 0x... address
  signature: authData.signature,  // base64 signature
  nonce: authData.nonce,         // unique nonce
  scope: 'master'                // access scope
}

// 3. Test IMAP authentication
LOGIN "0x..." "base64signature"

// 4. Test POP3 authentication  
USER 0x...
PASS base64signature

// 5. Test SMTP simulation
AUTH PLAIN <base64(\0username\0signature)>
```

## Error Testing

Tests comprehensive error scenarios:

- ❌ Invalid blockchain addresses
- ❌ Malformed signatures
- ❌ Nonce reuse attacks
- ❌ Missing signerAddress for ENS/SNS
- ❌ Protocol violations
- ❌ Unauthorized command attempts
- ❌ Rate limiting scenarios

## Security Testing

Verifies security features:

- 🔒 Nonce-based replay protection
- 🔒 Signature verification accuracy
- 🔒 ENS/SNS owner verification
- 🔒 Protocol-level security (STARTTLS/STLS)
- 🔒 Session isolation
- 🔒 Access control scopes

## Debugging Tests

### Verbose Output

```bash
# Enable verbose mocha output
npx mocha test/**/*auth*test.js --reporter spec --verbose

# Debug specific test
DEBUG=* npx mocha test/api/authentication-test.js
```

### Test Isolation

```bash
# Run single test case
npx mocha test/api/authentication-test.js --grep "should authenticate with valid EVM"

# Run specific describe block
npx mocha test/protocol/imap-auth-test.js --grep "EVM Wallet"
```

## Configuration

Tests use standard WildDuck configuration with these assumptions:

- **API Server**: `http://localhost:3000`
- **IMAP Server**: `localhost:9993`
- **POP3 Server**: `localhost:9110`  
- **LMTP Server**: `localhost:9024`

Modify `auth-test-utils.js` to change test configuration.

## Contributing

When adding new authentication tests:

1. **Use Test Utilities**: Leverage existing `auth-test-utils.js` functions
2. **Follow Patterns**: Match existing test structure and naming
3. **Test All Types**: Include EVM, Solana, ENS, and SNS variants
4. **Error Cases**: Always test both success and failure scenarios
5. **Protocol Compliance**: Follow RFC standards for protocol tests
6. **Documentation**: Update this README for new test capabilities

## Troubleshooting

### Common Issues

**Tests Timeout**: Ensure WildDuck server is running and accessible

**Connection Refused**: Check that all protocol servers are enabled in config

**Database Errors**: Verify MongoDB and Redis are running and accessible  

**Signature Failures**: Check that test wallets are properly initialized

### Debug Checklist

1. ✅ WildDuck server running (`npm start`)
2. ✅ All dependencies installed (`npm install`)
3. ✅ MongoDB accessible
4. ✅ Redis accessible  
5. ✅ Test configuration correct
6. ✅ No port conflicts

### Getting Help

- Check WildDuck logs: `tail -f logs/app.log`
- Enable debug mode: `DEBUG=* npm start`
- Review test output: `npm run test:auth -- --reporter json`
- Check server status: `curl http://localhost:3000/`

---

**Note**: These tests verify the blockchain authentication system implementation. They require a running WildDuck server and do not mock the authentication handlers, providing true end-to-end verification.