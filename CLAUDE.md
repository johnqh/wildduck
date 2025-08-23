# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Testing
- **Run all tests**: `npm test` (drops test DB, flushes Redis, runs full test suite)
- **Run only unit tests**: `npm run runtest` (skips DB setup, runs Grunt test suite)
- **Run IMAP core tests**: `NODE_ENV=test grunt mochaTest:imap`
- **Run API tests**: `NODE_ENV=test grunt mochaTest:api`
- **Test protocol behavior**: `npm run test:proto`

### Server Operations
- **Start server**: `npm start` or `node server.js`
- **Print configuration**: `npm run printconf` (shows config without starting server)
- **Development mode**: `npm run show` (print config only)

### Code Quality
- **Lint code**: `grunt eslint` (checks lib/, imap-core/, test/, examples/)
- **Generate API docs**: `npm run apidoc` (creates docs/api/ from lib/api/)
- **Auto-generate API docs**: `npm run generate-api-docs`

## Architecture Overview

WildDuck is a distributed, stateless email server that stores all data in MongoDB rather than the filesystem. It consists of multiple protocol servers that can run independently and scale horizontally.

### Core Components

**Main Entry Points:**
- `server.js`: Master process that handles clustering and initialization
- `worker.js`: Worker process that starts all protocol servers and services

**Protocol Servers:**
- `imap.js`: IMAP4 server for email client connections
- `pop3.js`: POP3 server for simple email retrieval
- `lmtp.js`: LMTP server for receiving incoming mail
- `api.js`: RESTful HTTP API server for webmail/management
- `acme.js`: ACME protocol server for SSL certificate management

**Storage Architecture:**
- MongoDB: Primary data store for users, messages, mailboxes
- Redis: Session management, caching, rate limiting, pub/sub
- GridFS/GridStore: Large attachment storage with deduplication
- Elasticsearch: Optional full-text search indexing

### Key Libraries

**Core Handlers (lib/):**
- `user-handler.js`: User management, authentication, address resolution
- `message-handler.js`: Email message processing and storage
- `mailbox-handler.js`: IMAP mailbox operations
- `filter-handler.js`: Server-side email filtering rules
- `attachment-storage.js`: Attachment deduplication and storage

**Protocol Implementation:**
- `imap-core/`: Custom IMAP4 protocol implementation
- `lib/handlers/`: IMAP command handlers (on-append.js, on-fetch.js, etc.)
- `lib/pop3/`: POP3 protocol server and connection handling

**Authentication & Security:**
- `blockchain-validator.js`: Validates blockchain addresses and names (EVM, Solana, ENS, SNS)
- `signature-verifier.js`: Cryptographic signature verification for blockchain authentication
- `name-resolver.js`: ENS/SNS name resolution to owner addresses
- `hashes.js`: Multi-algorithm password hashing (bcrypt, PBKDF2, legacy formats) - legacy use only
- `lib/api/2fa/`: Two-factor authentication (TOTP, WebAuthn, custom)
- `roles.js`: Access control and permission management

### Configuration System

Uses `wild-config` library with TOML configuration files in `config/`:
- `default.toml`: Base configuration
- `dbs.toml`: Database connection settings
- `imap.toml`, `pop3.toml`, `lmtp.toml`, `api.toml`: Protocol-specific settings
- Environment-specific configs override defaults

### Environment Variables

**Rate Limiting Control:**
- `ENABLE_RATE_LIMITING=true`: Enable authentication rate limiting (disabled by default)
- When disabled, all authentication attempts bypass rate limiting checks
- Useful for development, testing, and troubleshooting authentication issues

### External Integration

**MTA Integration:**
- Designed to work with external MTAs like Haraka or ZoneMTA
- `resolveAddress()` API allows external systems to trigger account creation
- Supports blockchain address validation for crypto-native email

**Plugin Architecture:**
- `plugins/`: Extensible plugin system
- `lib/plugins.js`: Plugin loader and manager
- Example plugins for Rspamd integration

### Development Notes

**Testing Requirements:**
- MongoDB and Redis must be running for tests
- Test environment uses separate databases (`wildduck-test`, Redis DB 13)
- Tests automatically reset databases before running

**Code Style:**
- ESLint configuration in Gruntfile.js
- No unused variables, consistent formatting
- Protocol implementations follow RFC specifications

**Multi-Process Architecture:**
- Supports clustering via `processes` config (default: 1)
- Each worker runs all protocol servers independently
- Shared state via MongoDB/Redis enables horizontal scaling

**Address Resolution:**
- Complex address lookup supporting aliases, wildcards, catch-alls
- Auto-creation feature for blockchain addresses (EVM, Solana, ENS, SNS)
- Case-insensitive domain handling with normalization

## Blockchain Authentication System

WildDuck implements a comprehensive blockchain-based authentication system that eliminates traditional passwords in favor of cryptographic signatures.

### Supported Identity Types

**Direct Addresses:**
- **EVM Addresses**: Standard Ethereum-compatible addresses (0x...)
- **Base64 EVM Addresses**: Base64-encoded EVM addresses for compact representation
- **Solana Addresses**: Base58-encoded Solana public keys

**Blockchain Names:**
- **ENS Names**: Ethereum Name Service (.eth, .box domains)
- **SNS Names**: Solana Name Service (.sol domains)

### Authentication Flow

1. **Username Validation**: System validates username format using `blockchain-validator.js`
2. **Address Resolution**: For ENS/SNS names, resolves to owner address via `name-resolver.js`
3. **Signature Verification**: Validates cryptographic signatures using `signature-verifier.js`
4. **Account Creation**: Auto-creates accounts for valid blockchain identifiers (when `options.create` is enabled)

### Authentication Methods

**Sign-in with Ethereum (SIWE):**
- Used for EVM addresses and ENS names
- Signature must be from the address owner
- Message format follows EIP-4361 standard
- Verified using viem library

**Sign-in with Solana:**
- Used for Solana addresses and SNS names  
- Ed25519 signature verification using tweetnacl
- Signature must be from the address owner
- Custom message format for Solana ecosystem

### Security Features

- **Nonce-based replay protection**: Prevents signature reuse attacks
- **Owner verification**: ENS/SNS signatures must come from the domain owner
- **Multi-chain support**: Supports both Ethereum and Solana ecosystems
- **No stored passwords**: Eliminates password-related security risks

### Integration Points

**User Creation (`user-handler.js`):**
- Modified `asyncResolveAddress()` validates blockchain usernames before auto-creation
- Updated user schema stores blockchain authentication metadata
- Removed password and temp fields from user accounts

**Authentication (`user-handler.js`):**
- Completely rewritten `asyncAuthenticate()` method
- Supports signature-based authentication for all identity types
- Maintains session management and rate limiting

### Dependencies

**Blockchain Libraries:**
- `viem`: Ethereum interaction and signature verification
- `@solana/web3.js`: Solana blockchain integration
- `tweetnacl`: Ed25519 signature verification for Solana
- `bs58`: Base58 encoding/decoding for Solana addresses

## File Organization & AI Context

### Core Module Patterns

**Handler Classes (`lib/*-handler.js`):**
- All handlers follow a similar constructor pattern with `options` parameter
- Use async/await for database operations with callback fallbacks
- Database operations typically use `this.database` or `this.users` collections
- Error handling follows consistent patterns with custom error codes

**API Endpoints (`lib/api/*.js`):**
- Export functions that register routes with `server.get/post/put/delete`
- Use Joi validation schemas for request/response validation
- Follow RESTful patterns with consistent response structures
- Authentication handled via `roles` middleware

**Database Collections:**
- `users`: User accounts, settings, quotas, authentication data
- `addresses`: Email addresses, aliases, forwarding rules
- `mailboxes`: IMAP folders, special use flags, retention policies
- `messages`: Email messages, headers, attachments, flags
- `journal`: Audit logs, user actions, system events
- `authlog`: Authentication attempts, rate limiting data

### Key Design Patterns

**Async/Callback Dual Interface:**
```javascript
// Most handlers support both patterns
handler.method(params, callback);           // Legacy callback style
await handler.methodAsync(params);          // Modern async/await
```

**Error Handling:**
```javascript
const err = new Error('Description');
err.code = 'CUSTOM_CODE';                  // Machine-readable code
err.responseCode = 400;                     // HTTP status code
throw err;
```

**Database Queries:**
```javascript
// Standard projection patterns
{ projection: { password: false, tempPasswd: false } }  // Hide sensitive data
{ projection: { _id: true, username: true } }           // Minimal data
```

**Configuration Access:**
```javascript
const config = require('wild-config');
const value = config.section.subsection.key;           // Nested config access
```

### Common Operations

**User Lookup:**
```javascript
// By ID
const user = await db.users.collection('users').findOne({ _id: userId });

// By address
const addressData = await userHandler.asyncResolveAddress(address, options);
```

**Message Operations:**
```javascript
// Store message
const result = await messageHandler.addMessage(user, mailbox, messageData);

// Fetch messages
const messages = await messageHandler.getMessages(user, mailbox, query);
```

**Authentication:**
```javascript
// Blockchain signature verification
const authResult = await userHandler.asyncAuthenticate(username, signature, options);

// Traditional session validation
const session = await userHandler.checkAuthToken(token);
```

### Security Considerations

**Input Validation:**
- All API inputs validated with Joi schemas
- Email addresses validated with `isemail` library
- Blockchain addresses validated with custom validators

**Access Control:**
- Role-based permissions via `roles.js`
- Session tokens for API authentication
- IP-based rate limiting via Redis

**Data Sanitization:**
- HTML content sanitized before storage
- File uploads scanned and validated
- SQL injection prevented by MongoDB's BSON

### Testing Patterns

**Test Structure:**
```javascript
describe('Component', () => {
    beforeEach(async () => {
        // Reset test database
        await db.database.collection('users').deleteMany({});
    });
    
    it('should handle operation', async () => {
        // Test implementation
    });
});
```

**Common Test Utilities:**
- `test/helpers/auth-test-utils.js`: Authentication helpers
- `test/helpers/blockchain-test-helpers.js`: Blockchain testing
- `test/fixtures/`: Test data and certificates

### Environment Variables

**Development:**
- `NODE_ENV=test`: Enables test database usage
- `NODE_CONFIG_ONLY=true`: Print config without starting server
- `ENABLE_RATE_LIMITING=true`: Enable auth rate limiting

**Production:**
- `UV_THREADPOOL_SIZE=16`: Optimize for I/O operations
- Database connection strings in environment or config files
- SSL certificate paths configured per protocol

### API Documentation

**OpenAPI Integration:**
- API schemas defined inline with route definitions
- Automatic documentation generation via `restifyapigenerate`
- Response schemas in `lib/schemas/response/`
- Request schemas in `lib/schemas/request/`

**Error Codes:**
- Standardized error responses across all endpoints
- Machine-readable error codes for client handling
- HTTP status codes follow REST conventions