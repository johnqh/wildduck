# WildDuck AI Quick Reference Guide

## 🚀 Getting Started

### First-Time Setup

```bash
# Get project status
node scripts/ai-assistant.js

# Check services
node scripts/ai-dev-helper.js

# Validate configuration
npm run printconf

# Run tests
npm run runtest
```

### AI Context Files

-   `.ai-project-context.md` - Comprehensive project overview
-   `.ai-current-context.json` - Dynamic project state (auto-generated)
-   `CLAUDE.md` - Complete development guide
-   `AI-QUICK-REFERENCE.md` - This quick reference

## 🏗️ Architecture Quick Map

```
WildDuck Email Server
├── server.js (master process)
├── worker.js (protocol servers)
├── Protocols
│   ├── imap.js (IMAP4 - port 9993)
│   ├── pop3.js (POP3 - port 9995)
│   ├── lmtp.js (Local delivery - port 2424)
│   └── api.js (REST API - port 8080)
├── Core Handlers (lib/)
│   ├── user-handler.js (users + blockchain auth)
│   ├── message-handler.js (email processing)
│   ├── mailbox-handler.js (IMAP folders)
│   └── signature-verifier.js (blockchain signatures)
└── Storage
    ├── MongoDB (primary data)
    ├── Redis (cache/sessions)
    └── GridFS (attachments)
```

## 🔐 Blockchain Authentication (Current State v6.10.0)

### Supported Identities

-   **EVM**: `0x742D35Cc6634C0532925A3B844bC9e7595f0bEB7`
-   **Solana**: `7VfCXTUXx5WJV5JADk17DUJ4ksgau7utNYKmKBfaVjMo`
-   **ENS**: `vitalik.eth`
-   **SNS**: `example.sol`

### Authentication Flow

1. Username validation → `GET /api/addresses/validate/:address`
2. Signature verification → `POST /api/signature/verify`
3. Auto-create user if valid blockchain identity

### Disabled Endpoints (v6.10.0)

-   `POST /users/:user/addresses` ❌
-   `PUT /users/:user/addresses/:id` ❌
-   `DELETE /users/:user/addresses/:address` ❌

## 📝 Development Patterns

### Handler Class

```javascript
class MyHandler {
    constructor(options) {
        this.database = options.database;
        this.redis = options.redis;
    }

    async doSomething(params) {
        try {
            // Validate
            if (!params.required) {
                throw new Error('Missing required parameter');
            }

            // Process
            const result = await this.database.collection('items').insertOne(params);

            return { success: true, id: result.insertedId };
        } catch (err) {
            err.code = 'OperationFailed';
            err.responseCode = 500;
            throw err;
        }
    }
}
```

### API Endpoint

```javascript
server.post(
    {
        path: '/api/resource',
        validationObjs: {
            requestBody: {
                name: Joi.string().required()
            },
            response: {
                200: {
                    /* schema */
                }
            }
        }
    },
    tools.responseWrapper(async (req, res) => {
        req.validate(roles.can(req.role).createAny('resource'));
        const result = await handler.create(req.params);
        return res.json({ success: true, data: result });
    })
);
```

### Error Handling

```javascript
let err = new Error('User not found');
err.code = 'UserNotFound';
err.responseCode = 404;
throw err;
```

## 🧪 Testing Commands

### Quick Tests

```bash
# All tests
npm test

# API tests only
NODE_ENV=test npx grunt mochaTest:api --force

# Blockchain auth tests
NODE_ENV=test npx mocha test --grep "signature" --timeout 10000

# Code quality
npx grunt eslint
```

### Service Tests

```bash
# Check MongoDB
mongosh wildduck

# Check Redis
redis-cli ping

# Check Indexer
curl http://localhost:42069/health
```

## 📊 Common Commands

### Development

| Command                         | Description            |
| ------------------------------- | ---------------------- |
| `npm start`                     | Start WildDuck server  |
| `npm run printconf`             | Validate configuration |
| `node scripts/ai-assistant.js`  | Get AI context         |
| `node scripts/ai-dev-helper.js` | Service diagnostics    |

### Database

| Command             | Description          |
| ------------------- | -------------------- |
| `mongosh wildduck`  | MongoDB shell        |
| `redis-cli`         | Redis shell          |
| `npm run test:auth` | Test blockchain auth |

### Git

| Command                  | Description     |
| ------------------------ | --------------- |
| `git status`             | Current changes |
| `git log --oneline -10`  | Recent commits  |
| `git diff --name-status` | Changed files   |

## ⚡ Troubleshooting

### Common Issues

**"Indexer service unavailable"**

```bash
# Check if indexer is running
curl http://localhost:42069/health

# Start indexer service
cd ../mail_box_indexer && npm run dev
```

**MongoDB connection failed**

```bash
# Check if MongoDB is running
mongosh --eval "db.runCommand('ping')"

# Check connection string
npm run printconf | grep mongo
```

**Tests failing**

```bash
# Reset test environment
NODE_ENV=test npm run runtest

# Check specific test
NODE_ENV=test npx mocha test/specific-test.js --timeout 10000
```

### Configuration Issues

-   Check `.env` files for missing variables
-   Verify `config/*.toml` files syntax
-   Run `npm run printconf` to validate

## 🔧 Configuration Quick Reference

### Environment Variables

```bash
# Indexer service
INDEXER_BASE_URL=http://localhost:42069

# Database
MONGODB_URL=mongodb://127.0.0.1:27017/wildduck

# Redis
REDIS_URL=redis://127.0.0.1:6379/3
```

### Key Config Files

-   `config/default.toml` - Base configuration
-   `config/dbs.toml` - Database connections
-   `config/api.toml` - API server settings
-   `.env` - Environment variables

## 📈 Version History

-   **v6.10.0**: Updated indexer endpoints, disabled address management
-   **v6.9.0**: Added blockchain authentication system
-   **v6.8.x**: Enhanced security and validation

## 🤖 AI Development Tips

1. **Always start with**: `node scripts/ai-assistant.js`
2. **Check services**: `node scripts/ai-dev-helper.js`
3. **Follow patterns**: Review existing handlers before creating new ones
4. **Test early**: Run tests after each change
5. **Lint code**: `npx grunt eslint` before committing
6. **Update context**: Run AI assistant after significant changes

## 📚 Additional Resources

-   `CLAUDE.md` - Comprehensive development guide
-   `.ai-project-context.md` - Detailed architecture overview
-   `docs/` - API documentation
-   `test/` - Test examples and patterns
