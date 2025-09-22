# WildDuck AI Development Guide

## Project Overview
WildDuck is a scalable IMAP/POP3 mail server built with Node.js and MongoDB, designed for high availability with no single point of failure.

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
- `imap.js` - IMAP server setup
- `pop3.js` - POP3 server setup
- `lmtp.js` - LMTP mail delivery server
- `api.js` - REST API server

### Core Libraries
- `lib/db.js` - Database connection management
- `lib/message-handler.js` - Message storage and retrieval
- `lib/user-handler.js` - User management operations
- `lib/mailbox-handler.js` - Mailbox operations
- `lib/imap-notifier.js` - Real-time IMAP notifications

### IMAP Handlers (lib/handlers/)
- `on-append.js` - Handle message append
- `on-copy.js` - Handle message copy (LINE 178: TRYCREATE response)
- `on-fetch.js` - Handle message fetch
- `on-search.js` - Handle message search
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
2. Define schemas in `lib/schemas/`
3. Update API documentation
4. Add tests in `test/api/`

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

### Unit Tests
```bash
# Run specific test file
npx mocha test/api/users-test.js

# Run with coverage
npx nyc npm test
```

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
- `config/default.toml` - Base configuration
- `config/development.toml` - Development overrides
- `config/production.toml` - Production settings

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
- Passwords hashed with PBKDF2/bcrypt
- Support for 2FA (TOTP, WebAuthn)
- Application-specific passwords

### Encryption
- TLS/SSL for all protocols
- Optional PGP message encryption
- Encrypted attachment storage

## Debugging Tips

### Enable Debug Logging
```javascript
// In config
[log]
level = "silly"

// In code
server.logger.debug({ tnx: 'copy', cid: session.id }, 'Debug message');
```

### Common Issues
1. **TRYCREATE error**: Target mailbox doesn't exist
2. **OVERQUOTA**: User storage limit exceeded
3. **Connection timeout**: Check MongoDB/Redis connectivity
4. **TLS errors**: Verify certificate configuration

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

## Resources
- [MongoDB Driver Docs](https://mongodb.github.io/node-mongodb-native/)
- [IMAP RFC 3501](https://tools.ietf.org/html/rfc3501)
- [Redis Commands](https://redis.io/commands)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)