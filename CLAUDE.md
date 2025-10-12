# WildDuck AI Development Guide

## Project Overview

WildDuck is a scalable IMAP/POP3 mail server built with Node.js and MongoDB, designed for high availability with no single point of failure.

This fork includes enhanced features for crypto emails mode and automatic user provisioning.

## Documentation Structure

This is the main AI development guide. For comprehensive information, see:

- **CLAUDE.md** (this file) - Quick reference for AI development
- **ARCHITECTURE.md** - System architecture and design patterns
- **PATTERNS.md** - Code patterns and examples
- **TESTING.md** - Testing strategies for both standard and crypto modes
- **API.md** - Complete API endpoint documentation
- **README.md** - Project overview and links

## Quick Reference for AI Development

### Most Common Tasks
- **Read user data**: lib/user-handler.js
- **Handle messages**: lib/message-handler.js
- **Add API endpoint**: lib/api/ + lib/schemas/request/ + lib/schemas/response/
- **Add IMAP command**: lib/handlers/on-[command].js
- **Modify authentication**: lib/api/auth.js (crypto mode affects /authenticate endpoint)
- **Check quota**: See lib/handlers/on-copy.js:95-104 for pattern
- **Encrypt messages**: See lib/handlers/on-copy.js:169-250 for pattern

### Environment Variables
- `APPCONF_api_cryptoEmails=true` - Enable crypto emails mode (auto-create users)
- `NODE_ENV=test` - Use test configuration
- `NODE_CONFIG_ONLY=true` - Show config without starting server

### Database Collections
- `users` - User accounts and settings
- `mailboxes` - User mailboxes (INBOX, Sent, etc.)
- `messages` - Email messages
- `addresses` - Email addresses
- `attachments.files` - GridFS attachments (deduplicated)
- `filters` - Message filtering rules
- `asps` - Application-specific passwords

## Quick Commands

### Development

```bash
# Start development server
npm start

# Run tests
npm test

# Check configuration
npm run show

# Generate API documentation
npm run generate-api-docs

# Lint code
npx eslint lib/**/*.js

# Type check (when TypeScript definitions are added)
# npm run typecheck
```

### Database Operations

```bash
# Connect to MongoDB
mongosh wildduck

# Connect to Redis
redis-cli

# View logs
tail -f logs/wildduck.log
```

## Architecture

### Core Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   IMAP      │     │    POP3     │     │    LMTP     │
│  (port 143) │     │  (port 110) │     │ (port 2424) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Worker    │
                    │  Process   │
                    └─────┬─────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ MongoDB │      │  Redis  │      │   API   │
   │         │      │         │      │(port 8080)│
   └─────────┘      └─────────┘      └─────────┘
```

### Data Flow

1. **Incoming Mail**: LMTP → MessageHandler → MongoDB
2. **Client Access**: IMAP/POP3 → Handlers → MongoDB → Client
3. **API Access**: REST API → UserHandler/MailboxHandler → MongoDB

## Key Files and Their Purpose

### Entry Points

- `server.js` - Main entry point, handles clustering
- `worker.js` - Worker process initialization
- `imap.js` - IMAP server setup (port 143/993)
- `pop3.js` - POP3 server setup (port 110/995)
- `lmtp.js` - LMTP mail delivery server (port 2424)
- `api.js` - REST API server (port 8080)
- `indexer.js` - Message indexing and search
- `tasks.js` - Background task processing
- `webhooks.js` - Webhook event processing
- `acme.js` - ACME/Let's Encrypt certificate management

### Core Libraries

- `lib/db.js` - Database connection management
- `lib/message-handler.js` - Message storage and retrieval
- `lib/user-handler.js` - User management operations
- `lib/mailbox-handler.js` - Mailbox operations
- `lib/imap-notifier.js` - Real-time IMAP notifications

### IMAP Handlers (lib/handlers/)

- `on-append.js` - Handle message append
- `on-auth.js` - Handle authentication
- `on-copy.js` - Handle message copy (lib/handlers/on-copy.js:147 returns TRYCREATE when target mailbox doesn't exist)
- `on-create.js` - Handle mailbox creation
- `on-delete.js` - Handle mailbox deletion
- `on-expunge.js` - Handle message expunge
- `on-fetch.js` - Handle message fetch
- `on-get-quota-root.js` - Handle quota root queries
- `on-get-quota.js` - Handle quota queries
- `on-list.js` - Handle mailbox listing
- `on-lsub.js` - Handle subscribed mailbox listing
- `on-move.js` - Handle message move
- `on-open.js` - Handle mailbox open/select
- `on-rename.js` - Handle mailbox rename
- `on-search.js` - Handle message search
- `on-status.js` - Handle mailbox status
- `on-store.js` - Handle flag updates

## Database Schema

### Collections

```javascript
// users collection
{
  _id: ObjectId,
  username: String,
  password: String (hashed),
  quota: Number,
  storageUsed: Number,
  pubKey: String (optional, for encryption),
  // ... other fields
}

// mailboxes collection
{
  _id: ObjectId,
  user: ObjectId,
  path: String (e.g., "INBOX", "Sent"),
  uidNext: Number,
  uidValidity: Number,
  specialUse: String (e.g., "\\Sent", "\\Trash"),
  // ... other fields
}

// messages collection
{
  _id: ObjectId,
  mailbox: ObjectId,
  user: ObjectId,
  uid: Number,
  size: Number,
  flags: Array,
  mimeTree: Object,
  // ... other fields
}
```

## Common Development Tasks

### Adding a New API Endpoint

1. Add handler in `lib/api/[module].js`
2. Define request schemas in `lib/schemas/request/`
3. Define response schemas in `lib/schemas/response/`
4. Update API documentation (npm run generate-api-docs)
5. Add tests in `test/api/`

### Adding a New IMAP Command

1. Create handler in `lib/handlers/on-[command].js`
2. Register in `imap.js`
3. Add tests in `test/imap/`

### Modifying Message Storage

1. Update `lib/message-handler.js`
2. Check indexes in `indexes.yaml`
3. Update related handlers in `lib/handlers/`

## Error Handling Patterns

```javascript
// Standard error handling
try {
    const result = await db.database.collection('messages').findOne({...});
    if (!result) {
        return callback(null, 'NONEXISTENT');
    }
    // process result
} catch (err) {
    return callback(err);
}

// IMAP response codes
'TRYCREATE' - Mailbox doesn't exist, should be created
'NONEXISTENT' - Referenced item doesn't exist
'OVERQUOTA' - User quota exceeded
'ALREADYEXISTS' - Item already exists
```

## Testing Guidelines

### Test Modes

This fork supports testing in both standard and crypto emails modes:

```bash
# Run all tests (default: crypto mode)
npm test

# Run tests in standard authentication mode
npm run test:standard

# Run tests in crypto emails mode
npm run test:crypto

# Run both modes sequentially
npm run test:both

# API tests only
npm run test:api:standard
npm run test:api:crypto

# IMAP tests only
npm run test:imap:standard
npm run test:imap:crypto
```

### Unit Tests

```bash
# Run specific test file
npx mocha test/api/users-test.js

# Run with coverage
npx nyc npm test

# Run specific test in crypto mode
APPCONF_api_cryptoEmails=true NODE_ENV=test npx mocha test/api/users-test.js
```

For detailed testing documentation, see **TESTING.md**

### Manual Testing

```bash
# Test IMAP connection
openssl s_client -connect localhost:993 -crlf
# Login: a login testuser password
# List: a list "" "*"
# Select: a select INBOX

# Test API
curl -X GET http://localhost:8080/users \
  -H "X-Access-Token: YOUR_TOKEN"
```

## Configuration

### Key Configuration Files

WildDuck uses a modular configuration system with TOML files:

- `config/default.toml` - Main configuration file with @include directives
- `config/api.toml` - API server configuration
- `config/imap.toml` - IMAP server configuration
- `config/pop3.toml` - POP3 server configuration
- `config/lmtp.toml` - LMTP server configuration
- `config/dbs.toml` - Database connection settings
- `config/tls.toml` - TLS/SSL certificate settings
- `config/test.toml` - Test environment overrides
- `config/roles.json` - Role-based access control definitions

### Important Settings

```toml
# Database connections
[dbs]
mongo = "mongodb://127.0.0.1:27017/wildduck"
redis = "redis://127.0.0.1:6379/3"

# Server ports
[imap]
port = 143
secure = true
securePort = 993

[api]
port = 8080
```

## Performance Considerations

### Database Indexes

- Check `indexes.yaml` for required indexes
- Run indexing after schema changes
- Monitor slow queries in MongoDB logs

### Scaling

- Use `processes = "cpus"` for multi-core
- Configure MongoDB sharding for large deployments
- Use Redis Cluster for session distribution

## Security Notes

### Authentication

This fork supports two authentication modes:

#### Standard Authentication Mode
- Traditional username/password authentication
- Passwords hashed with PBKDF2/bcrypt
- Requires existing user accounts
- Full password validation

#### Crypto Emails Mode (Custom Feature)
- Enabled via `APPCONF_api_cryptoEmails=true` environment variable
- Auto-creates user accounts if they don't exist
- No password validation required for `/authenticate` endpoint
- Requires `emailDomain` parameter instead of password
- Useful for blockchain/crypto applications
- See TESTING.md and API.md for implementation details

#### Additional Authentication Features
- Support for 2FA (TOTP, WebAuthn)
- Application-specific passwords
- Role-based access control (config/roles.json)

### Encryption

- **Transport Security**: TLS/SSL for all protocols (IMAPS, POP3S, HTTPS)
- **Message Encryption**: Optional PGP/GPG encryption for messages
  - User public key stored in `users.pubKey` field
  - Mailbox-level encryption via `mailboxes.encryptMessages` flag
  - Automatic encryption in lib/handlers/on-copy.js:169-250 when copying to encrypted mailbox
- **Attachment Storage**: Deduplicated and optionally encrypted in GridFS
- **Password Security**: PBKDF2/bcrypt hashing with configurable rounds

## Debugging Tips

### Enable Debug Logging

```javascript
// In config (config/default.toml)
[log]
level = 'silly'

// In code
server.logger.debug({ tnx: 'copy', cid: session.id }, 'Debug message');
```

### Common Issues

1. **TRYCREATE error**: Target mailbox doesn't exist (on-copy.js:147)
2. **OVERQUOTA**: User storage limit exceeded (on-copy.js:103)
3. **Connection timeout**: Check MongoDB/Redis connectivity
4. **TLS errors**: Verify certificate configuration
5. **Authentication fails in crypto mode**: Ensure `APPCONF_api_cryptoEmails=true` is set
6. **Tests fail**: Make sure MongoDB is running and Redis db 13 is accessible

## AI Development Notes

### When Modifying Code

1. **Always check existing patterns**: See PATTERNS.md for code examples
2. **Preserve line-based references**: When editing handlers, note that line numbers in comments should be updated if code moves
3. **Test both modes**: If modifying auth, test both standard and crypto modes
4. **Check encryption impact**: Some operations need encryption handling (see on-copy.js)
5. **Update indexes**: If adding new query patterns, check indexes.yaml

### Common Pitfalls

1. **Don't forget maxTimeMS**: All MongoDB queries should have timeout (consts.DB_MAX_TIME_*)
2. **Check socket health**: Long operations should check socket with tools.checkSocket(socket)
3. **Handle encryption**: Check if target mailbox has encryption enabled before operations
4. **Update quotas**: Operations that add messages must update user storage quota
5. **Fire notifications**: IMAP operations need to notify connected clients via server.notifier

### Performance Considerations

1. **Use bulk operations**: For multiple updates, use bulkWrite instead of individual updates
2. **Cursor cleanup**: Always close cursors in finally blocks
3. **Avoid N+1 queries**: Batch database operations when possible
4. **Cache wisely**: Frequent lookups should use Redis cache with appropriate TTL
5. **Index coverage**: Queries should use existing indexes (see indexes.yaml)

## Code Style

### Async/Await Pattern

```javascript
async function handler(params) {
    try {
        const result = await db.collection.findOne({...});
        return { success: true, data: result };
    } catch (err) {
        log.error('Handler', 'Failed: %s', err.message);
        throw err;
    }
}
```

### Error First Callbacks (Legacy)

```javascript
function oldHandler(params, callback) {
    db.collection.findOne({...}, (err, result) => {
        if (err) return callback(err);
        callback(null, result);
    });
}
```

## Contributing

### Before Committing

1. Run linter: `npx eslint lib/**/*.js`
2. Run tests: `npm test`
3. Update documentation if needed
4. Check for security issues

### Commit Message Format

```
type(scope): description

- Detailed change 1
- Detailed change 2

Fixes #issue
```

## Important Code Locations

### Authentication Implementation
- Standard auth: lib/api/auth.js
- User handler: lib/user-handler.js
- Crypto emails mode: Controlled by `APPCONF_api_cryptoEmails` environment variable

### Message Encryption
- Encryption handler: lib/message-handler.js (encryptMessages method)
- Copy with encryption: lib/handlers/on-copy.js:169-250
- Message preparation: lib/message-handler.js (prepareMessage method)

### Key IMAP Response Codes (lib/handlers/)
- **TRYCREATE**: on-copy.js:147 - Target mailbox doesn't exist
- **OVERQUOTA**: on-copy.js:103 - User quota exceeded
- **NONEXISTENT**: on-copy.js:123 - Source mailbox doesn't exist

## API Development Tips

1. **Use Joi for validation**: All API endpoints should define request/response schemas
2. **Check user quota**: Before operations that add data (see on-copy.js:95-104)
3. **Handle encryption**: Check mailbox encryption settings before message operations
4. **Log appropriately**: Use structured logging with session context
5. **Respond with standard format**: `{ success: true/false, error?, data? }`

## Resources

### Official Documentation
- [WildDuck Website](https://wildduck.email)
- [WildDuck Docs](https://docs.wildduck.email)
- [API Documentation](https://docs.wildduck.email/docs/category/wildduck-api)

### Technical References
- [MongoDB Driver Docs](https://mongodb.github.io/node-mongodb-native/)
- [IMAP RFC 3501](https://tools.ietf.org/html/rfc3501)
- [Redis Commands](https://redis.io/commands)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Restify Framework](http://restify.com/)
- [Wild-Config](https://github.com/nodemailer/wild-config) - Configuration management

### This Fork
- **Package**: @sudobility/wildduck
- **Repository**: github.com/sudobility/wildduck
- **Version**: 0.0.2 (as of package.json)
- **License**: EUPL-1.2
- **Organization**: Sudobility
