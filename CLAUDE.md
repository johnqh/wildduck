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