# WildDuck Testing Guide

WildDuck has comprehensive test suites that support both **standard authentication** and **crypto emails mode**.

## Test Modes

### Standard Authentication Mode
- Uses traditional username/password authentication
- Password is required for `/authenticate` endpoint
- Follows standard email server authentication patterns

### Crypto Emails Mode
- Skips password validation for `/authenticate` endpoint
- Auto-creates user accounts if they don't exist
- Requires `emailDomain` parameter instead of password
- Useful for blockchain/crypto applications

## Available Test Commands

### Full Test Suites

```bash
# Run all tests with default configuration (crypto emails enabled)
npm test

# Run all tests in standard authentication mode
npm run test:standard

# Run all tests in crypto emails mode
npm run test:crypto

# Run both modes sequentially
npm run test:both
```

### API Tests Only

```bash
# API tests in standard mode (password required)
npm run test:api:standard

# API tests in crypto mode (auto-create users)
npm run test:api:crypto
```

### IMAP Tests Only

```bash
# IMAP tests in standard mode
npm run test:imap:standard

# IMAP tests in crypto mode
npm run test:imap:crypto
```

## Environment Variables

The test behavior is controlled by the `APPCONF_api_cryptoEmails` environment variable:

- `APPCONF_api_cryptoEmails=true` - Enables crypto emails mode
- `APPCONF_api_cryptoEmails=false` - Uses standard authentication

Note: WildDuck uses wild-config which requires the `APPCONF_` prefix for environment variables.

## Authentication Test Differences

### Standard Mode (`APPCONF_api_cryptoEmails=false`)

```javascript
// POST /authenticate
{
  "username": "testuser",
  "password": "secretpassword",  // Required
  "token": true
}
```

### Crypto Mode (`APPCONF_api_cryptoEmails=true`)

```javascript
// POST /authenticate
{
  "username": "testuser",
  "emailDomain": "example.com",  // Required instead of password
  "token": true
}
// Creates user testuser@example.com if doesn't exist
```

## Test Database

All tests use a separate test database (`wildduck-test`) and Redis database (db 13) to avoid interfering with development or production data.

The test suite automatically:
1. Drops the test database
2. Flushes Redis test DB
3. Runs the tests
4. Cleans up after completion

## Running Individual Test Files

You can also run specific test files with the appropriate environment variable:

```bash
# Standard mode
APPCONF_api_cryptoEmails=false NODE_ENV=test npx mocha test/api/users-test.js

# Crypto mode
APPCONF_api_cryptoEmails=true NODE_ENV=test npx mocha test/api/users-test.js
```

## CI/CD Integration

For continuous integration, you may want to run both modes:

```bash
# In your CI pipeline
npm run test:both
```

This ensures your changes work correctly in both authentication modes.

## Debugging Tests

To debug failing tests:

1. Check which mode is being used
2. Verify the authentication requests match the expected format
3. Use the individual test commands to isolate issues
4. Check the test logs for specific error messages

## Test Coverage

Both modes test:
- User creation and management
- Authentication flows
- IMAP protocol compliance
- API endpoint functionality
- Error handling
- Security features

The main difference is in authentication behavior - crypto mode is more permissive and auto-creates accounts, while standard mode requires existing users with valid passwords.