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
- `signature-verifier.js`: Delegates signature verification to mail_box_indexer service
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

WildDuck supports a flexible environment variable system with fallback support:

**Loading Priority:**
1. `process.env` (highest priority)
2. `.env` file (main configuration)
3. `.env.local` file (local overrides, git-ignored)

**Usage:**
```javascript
const env = require('./lib/env-loader');
const value = env.get('VARIABLE_NAME', 'default_value');
```

**Key Variables:**
- `ENABLE_RATE_LIMITING=true`: Enable authentication rate limiting (disabled by default)
- `MAIL_BOX_INDEXER_URL`: URL for signature verification service (default: http://localhost:42069)
- `NODE_ENV`: Runtime environment (development/production/test)
- `UV_THREADPOOL_SIZE`: Node.js threadpool size for I/O operations (default: 16)

**Configuration Files:**
- `.env.example`: Template with all available variables and documentation
- `.env`: Main environment file (tracked by git, no sensitive values)
- `.env.local`: Local overrides (git-ignored, for sensitive/local values)
- `.env.local.example`: Template for local development setup

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
3. **Signature Verification**: Validates cryptographic signatures via mail_box_indexer service
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
- `MAIL_BOX_INDEXER_URL`: URL for mail_box_indexer service (default: http://localhost:42069)
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

## AI Development Guidelines

### Quick Start Commands
```bash
# Test the current state
npm test

# Check code quality
grunt eslint

# Start development server
npm start

# Check configuration
npm run printconf

# Run specific blockchain tests
NODE_ENV=test npx mocha test --grep "signature" --timeout 10000
```

### File Modification Patterns
- **Handler Classes**: Follow constructor patterns in `lib/*-handler.js`
- **API Endpoints**: Use patterns from `lib/api/*.js` with Joi validation
- **Database Schemas**: Reference existing collections in MongoDB
- **Authentication**: Leverage blockchain auth patterns from recent commits

### Common Debugging Steps
1. Check MongoDB connection and collections
2. Verify Redis connection for caching/sessions
3. Test blockchain signature verification endpoints
4. Validate configuration loading with `npm run printconf`
5. Run specific test suites: `NODE_ENV=test grunt mochaTest:api`

### Integration Points
- **mail_box_indexer**: Signature verification service at localhost:42069
- **MongoDB**: Primary data store with GridFS for attachments
- **Redis**: Caching, rate limiting, and pub/sub
- **Elasticsearch**: Optional full-text search (see configuration)

### Architecture Quick Reference
- **Entry Points**: `server.js` (master), `worker.js` (protocols)
- **Protocols**: `imap.js`, `pop3.js`, `lmtp.js`, `api.js`, `acme.js`
- **Core Logic**: `lib/user-handler.js`, `lib/message-handler.js`, `lib/mailbox-handler.js`
- **Authentication**: `lib/signature-verifier.js` → mail_box_indexer service
- **Configuration**: `config/*.toml` files with environment variable overrides

### AI-Friendly Development Patterns

#### Code Analysis Workflow
1. **Read Context**: Always examine related files before making changes
2. **Pattern Recognition**: Follow existing code patterns and naming conventions
3. **Dependency Check**: Verify required dependencies are available before using libraries
4. **Error Handling**: Follow established error handling patterns in the codebase
5. **Testing**: Run appropriate test suites after changes

#### Common AI Tasks
- **Feature Addition**: Follow existing handler patterns in `lib/` directory
- **API Development**: Use established Joi schemas and error response patterns
- **Database Operations**: Follow MongoDB patterns with proper error handling
- **Authentication**: Leverage blockchain-based auth system for new features
- **Configuration**: Use wild-config patterns and environment variable fallbacks

#### AI Optimization Tools
- **Development Helper**: `node scripts/ai-dev-helper.js` - Comprehensive diagnostics
- **Context File**: `.ai-context.json` - Quick project overview for AI systems
- **Quick Commands**: Pre-configured npm scripts for common development tasks
- **Architecture Maps**: Clear component relationships and data flow documentation

#### Development Workflow Best Practices
- **Before Changes**: Read relevant files and understand existing patterns
- **During Development**: Follow established conventions and error handling
- **After Changes**: Run tests and lint code
- **Documentation**: Update comments and documentation as needed
- **Version Control**: Commit with descriptive messages following project patterns
- **AI Diagnostics**: Use `node scripts/ai-dev-helper.js` to verify system state