# WildDuck Code Patterns and Examples

This document provides common code patterns and examples for working with the WildDuck codebase.

## Table of Contents

1. [Database Operations](#database-operations)
2. [Message Handling](#message-handling)
3. [User Management](#user-management)
4. [IMAP Command Handlers](#imap-command-handlers)
5. [API Endpoints](#api-endpoints)
6. [Error Handling](#error-handling)
7. [Authentication](#authentication)
8. [Background Tasks](#background-tasks)
9. [Real-time Notifications](#real-time-notifications)
10. [Testing Patterns](#testing-patterns)

## Database Operations

### Basic MongoDB Query Pattern

```javascript
const { ObjectId } = require('mongodb');
const db = require('./lib/db');
const consts = require('./lib/consts');

async function getUserById(userId) {
    try {
        const user = await db.users.collection('users').findOne(
            {
                _id: new ObjectId(userId)
            },
            {
                projection: {
                    username: 1,
                    address: 1,
                    quota: 1,
                    storageUsed: 1
                },
                maxTimeMS: consts.DB_MAX_TIME_USERS
            }
        );

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    } catch (err) {
        log.error('DB', 'Failed to fetch user: %s', err.message);
        throw err;
    }
}
```

### Transaction Pattern

```javascript
async function transferMessage(messageId, sourceMailbox, targetMailbox) {
    const session = db.database.client.startSession();

    try {
        await session.withTransaction(async () => {
            // Remove from source
            await db.database.collection('messages').deleteOne({ _id: messageId, mailbox: sourceMailbox }, { session });

            // Add to target
            await db.database.collection('messages').insertOne(
                {
                    _id: new ObjectId(),
                    mailbox: targetMailbox
                    // ... other fields
                },
                { session }
            );

            // Update counters
            await db.database.collection('mailboxes').bulkWrite(
                [
                    {
                        updateOne: {
                            filter: { _id: sourceMailbox },
                            update: { $inc: { total: -1 } }
                        }
                    },
                    {
                        updateOne: {
                            filter: { _id: targetMailbox },
                            update: { $inc: { total: 1 } }
                        }
                    }
                ],
                { session }
            );
        });

        return { success: true };
    } catch (err) {
        log.error('DB', 'Transaction failed: %s', err.message);
        throw err;
    } finally {
        await session.endSession();
    }
}
```

### Pagination Pattern

```javascript
async function listMessages(mailbox, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
        db.database.collection('messages').find({ mailbox }).sort({ uid: -1 }).skip(skip).limit(limit).toArray(),

        db.database.collection('messages').countDocuments({ mailbox })
    ]);

    return {
        messages,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
}
```

## Message Handling

### Adding a New Message

```javascript
const MessageHandler = require('./lib/message-handler');

async function addMessage(user, mailbox, messageData) {
    const messageHandler = new MessageHandler({ database: db.database });

    return new Promise((resolve, reject) => {
        messageHandler.add(
            {
                user,
                mailbox,
                raw: messageData.raw,
                flags: messageData.flags || [],
                date: messageData.date || new Date(),
                draft: messageData.draft || false
            },
            (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    id: response.id,
                    uid: response.uid,
                    mailbox: response.mailbox
                });
            }
        );
    });
}
```

### Message Search Pattern

```javascript
async function searchMessages(user, query) {
    const filter = {
        user,
        searchable: true
    };

    // Parse search query
    if (query.text) {
        filter.$text = { $search: query.text };
    }

    if (query.from) {
        filter['headers.from'] = new RegExp(query.from, 'i');
    }

    if (query.dateAfter) {
        filter.idate = { $gte: new Date(query.dateAfter) };
    }

    const messages = await db.database
        .collection('messages')
        .find(filter)
        .project({
            _id: 1,
            uid: 1,
            mailbox: 1,
            subject: 1,
            from: 1,
            idate: 1,
            size: 1,
            flags: 1
        })
        .limit(100)
        .toArray();

    return messages;
}
```

### Message Encryption Pattern

```javascript
async function encryptMessage(userData, messageContent) {
    if (!userData.pubKey) {
        throw new Error('User public key not found');
    }

    return new Promise((resolve, reject) => {
        messageHandler.encryptMessages(userData.pubKey, messageContent, (err, encrypted) => {
            if (err) {
                return reject(err);
            }
            resolve(encrypted);
        });
    });
}
```

## User Management

### Creating a User

```javascript
const UserHandler = require('./lib/user-handler');
const bcrypt = require('bcryptjs');

async function createUser(userData) {
    const userHandler = new UserHandler({ database: db.database });

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    return new Promise((resolve, reject) => {
        userHandler.create(
            {
                username: userData.username,
                password: hashedPassword,
                address: userData.address,
                name: userData.name,
                quota: userData.quota || 1024 * 1024 * 100, // 100MB default
                tags: userData.tags || [],
                addTagsToAddress: true,
                metadata: userData.metadata || {}
            },
            (err, id) => {
                if (err) {
                    return reject(err);
                }
                resolve({ id, username: userData.username });
            }
        );
    });
}
```

### Authentication Pattern

```javascript
async function authenticateUser(username, password, ip) {
    const userHandler = new UserHandler({ database: db.database });

    return new Promise((resolve, reject) => {
        userHandler.authenticate(
            username,
            password,
            'imap', // scope
            {
                protocol: 'IMAP',
                ip,
                time: new Date()
            },
            (err, authData) => {
                if (err) {
                    return reject(err);
                }

                if (!authData) {
                    return reject(new Error('Invalid credentials'));
                }

                resolve({
                    user: authData.user,
                    username: authData.username,
                    require2fa: authData.require2fa,
                    requirePasswordChange: authData.requirePasswordChange
                });
            }
        );
    });
}
```

## IMAP Command Handlers

### Basic Handler Pattern

```javascript
// lib/handlers/on-custom.js
module.exports = (server, messageHandler) => {
    return async (connection, mailbox, options, session, callback) => {
        try {
            // Validate session
            if (!session.user) {
                return callback(null, 'NO [AUTHENTICATIONFAILED] Not authenticated');
            }

            // Validate mailbox
            const mailboxData = await db.database.collection('mailboxes').findOne({
                _id: mailbox,
                user: session.user.id
            });

            if (!mailboxData) {
                return callback(null, 'NO [NONEXISTENT] Mailbox not found');
            }

            // Perform operation
            const result = await performOperation(mailboxData, options);

            // Return success
            callback(null, true, result);
        } catch (err) {
            server.logger.error(
                {
                    tnx: 'custom',
                    cid: session.id,
                    err
                },
                'Custom command failed'
            );

            callback(err);
        }
    };
};
```

### COPY Command Example (from on-copy.js)

```javascript
async function copyHandler(server, messageHandler, connection, mailbox, update, session) {
    const socket = (session.socket && session.socket._parent) || session.socket;

    // Check user quota
    const userData = await db.users.collection('users').findOne({
        _id: session.user.id
    });

    if (userData.quota && userData.storageUsed > userData.quota) {
        return 'OVERQUOTA';
    }

    // Verify target mailbox exists
    const targetData = await db.database.collection('mailboxes').findOne({
        user: session.user.id,
        path: update.destination
    });

    if (!targetData) {
        return 'TRYCREATE'; // Target doesn't exist
    }

    // Copy messages
    const cursor = await db.database.collection('messages').find({
        mailbox: mailbox,
        uid: tools.checkRangeQuery(update.messages)
    });

    const sourceUid = [];
    const destinationUid = [];

    let messageData;
    while ((messageData = await cursor.next())) {
        // Get next UID for target
        const uidNext = await getNextUid(targetData._id);

        sourceUid.push(messageData.uid);
        destinationUid.push(uidNext);

        // Copy message with new UID
        messageData._id = new ObjectId();
        messageData.mailbox = targetData._id;
        messageData.uid = uidNext;

        await db.database.collection('messages').insertOne(messageData);
    }

    return [
        true,
        {
            uidValidity: targetData.uidValidity,
            sourceUid,
            destinationUid
        }
    ];
}
```

## API Endpoints

### RESTful Endpoint Pattern

```javascript
// lib/api/custom.js
module.exports = (server, db, userHandler) => {
    // GET endpoint
    server.get(
        {
            path: '/users/:user/custom',
            summary: 'Get custom data',
            tags: ['Custom'],
            validationObjs: {
                pathParams: {
                    user: Joi.string().hex().lowercase().length(24).required()
                },
                queryParams: {
                    limit: Joi.number().min(1).max(100).default(20)
                },
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            success: Joi.boolean().required(),
                            data: Joi.array().items(Joi.object())
                        })
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            const { user } = req.params;
            const { limit } = req.query;

            // Verify user exists
            const userData = await db.users.collection('users').findOne({
                _id: new ObjectId(user)
            });

            if (!userData) {
                res.status(404);
                return res.json({
                    error: 'User not found',
                    code: 'UserNotFound'
                });
            }

            // Fetch data
            const data = await fetchCustomData(user, limit);

            return res.json({
                success: true,
                data
            });
        })
    );

    // POST endpoint
    server.post(
        {
            path: '/users/:user/custom',
            summary: 'Create custom data',
            tags: ['Custom'],
            validationObjs: {
                pathParams: {
                    user: Joi.string().hex().lowercase().length(24).required()
                },
                requestBody: {
                    name: Joi.string().max(100).required(),
                    value: Joi.any().required()
                },
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            success: Joi.boolean().required(),
                            id: Joi.string().required()
                        })
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            const { user } = req.params;
            const { name, value } = req.body;

            const result = await db.database.collection('custom').insertOne({
                user: new ObjectId(user),
                name,
                value,
                created: new Date()
            });

            return res.json({
                success: true,
                id: result.insertedId.toString()
            });
        })
    );
};
```

## Error Handling

### Standard Error Pattern

```javascript
class CustomError extends Error {
    constructor(message, code, responseCode = 500) {
        super(message);
        this.code = code;
        this.responseCode = responseCode;
    }
}

async function handleOperation(data) {
    try {
        const result = await riskyOperation(data);
        return { success: true, result };
    } catch (err) {
        // Log error with context
        log.error('Operation', {
            err,
            data,
            stack: err.stack
        });

        // Handle specific errors
        if (err.code === 11000) {
            throw new CustomError('Duplicate entry', 'DUPLICATE', 409);
        }

        if (err.name === 'ValidationError') {
            throw new CustomError('Invalid input', 'VALIDATION_ERROR', 400);
        }

        // Generic error
        throw new CustomError('Operation failed', 'INTERNAL_ERROR', 500);
    }
}
```

### IMAP Error Responses

```javascript
function handleIMAPError(err, session) {
    if (err.code === 'OVERQUOTA') {
        return 'NO [OVERQUOTA] Quota exceeded';
    }

    if (err.code === 'NONEXISTENT') {
        return 'NO [NONEXISTENT] Mailbox does not exist';
    }

    if (err.code === 'ALREADYEXISTS') {
        return 'NO [ALREADYEXISTS] Mailbox already exists';
    }

    if (err.code === 'CANNOT') {
        return 'NO [CANNOT] Operation not permitted';
    }

    // Log unexpected errors
    server.logger.error({
        tnx: 'error',
        cid: session.id,
        err
    });

    return 'NO Internal server error';
}
```

## Authentication

### Two-Factor Authentication

```javascript
const speakeasy = require('speakeasy');

async function verify2FA(user, token) {
    const userData = await db.users.collection('users').findOne({
        _id: user
    });

    if (!userData.totp) {
        throw new Error('2FA not enabled');
    }

    const verified = speakeasy.totp.verify({
        secret: userData.totp.secret,
        encoding: 'base32',
        token,
        window: 2
    });

    if (!verified) {
        throw new Error('Invalid 2FA token');
    }

    return true;
}
```

### Application-Specific Passwords

```javascript
async function createASP(user, description, scopes) {
    const password = generatePassword(16);
    const hashedPassword = await bcrypt.hash(password, 10);

    const asp = {
        _id: new ObjectId(),
        user,
        description,
        scopes,
        password: hashedPassword,
        created: new Date(),
        lastUsed: null,
        useCount: 0
    };

    await db.users.collection('asps').insertOne(asp);

    return {
        id: asp._id,
        password // Return only once
    };
}
```

## Background Tasks

### Task Handler Pattern

```javascript
// lib/tasks/custom-task.js
module.exports = {
    title: 'Custom Task',
    description: 'Performs custom background operation',

    async task(context, taskData, options, callback) {
        const { database, redis } = context;

        try {
            // Lock to prevent concurrent execution
            const lock = await redis.set(
                `lock:task:${taskData._id}`,
                '1',
                'EX',
                300, // 5 minute lock
                'NX'
            );

            if (!lock) {
                return callback(new Error('Task already running'));
            }

            // Perform task
            const result = await performTask(database, taskData.data);

            // Clean up
            await redis.del(`lock:task:${taskData._id}`);

            callback(null, result);
        } catch (err) {
            // Release lock on error
            await redis.del(`lock:task:${taskData._id}`);
            callback(err);
        }
    }
};
```

### Scheduled Task Pattern

```javascript
const schedule = require('node-schedule');

function setupScheduledTasks() {
    // Run every hour
    schedule.scheduleJob('0 * * * *', async () => {
        log.info('Scheduler', 'Running hourly cleanup');

        try {
            // Delete expired messages
            const result = await db.database.collection('messages').deleteMany({
                exp: true,
                rdate: { $lte: new Date() }
            });

            log.info('Scheduler', 'Deleted %s expired messages', result.deletedCount);
        } catch (err) {
            log.error('Scheduler', 'Cleanup failed: %s', err.message);
        }
    });

    // Run daily at 2 AM
    schedule.scheduleJob('0 2 * * *', async () => {
        log.info('Scheduler', 'Running daily quota recalculation');

        await recalculateQuotas();
    });
}
```

## Real-time Notifications

### IMAP IDLE Notifications

```javascript
const ImapNotifier = require('./lib/imap-notifier');

function setupNotifier() {
    const notifier = new ImapNotifier({
        database: db.database,
        redis: db.redis
    });

    // Notify on new message
    notifier.addEntries(
        mailbox,
        {
            command: 'EXISTS',
            uid: messageData.uid,
            message: messageData._id,
            modseq: messageData.modseq
        },
        () => {
            log.info('Notifier', 'Notification sent for mailbox %s', mailbox._id);
        }
    );

    // Fire notifications
    notifier.fire(userId, mailboxPath);

    return notifier;
}
```

### WebSocket Notifications

```javascript
const io = require('socket.io')(server);

io.on('connection', socket => {
    socket.on('subscribe', async data => {
        const { user, mailbox } = data;

        // Verify user
        const authenticated = await verifySocketAuth(socket, user);
        if (!authenticated) {
            return socket.disconnect();
        }

        // Join room for mailbox
        socket.join(`mailbox:${mailbox}`);

        // Send initial state
        const state = await getMailboxState(mailbox);
        socket.emit('mailbox:state', state);
    });
});

// Emit notifications
function notifyMailboxUpdate(mailbox, update) {
    io.to(`mailbox:${mailbox}`).emit('mailbox:update', update);
}
```

## Testing Patterns

### Unit Test Pattern

```javascript
// test/unit/user-handler-test.js
const { expect } = require('chai');
const sinon = require('sinon');

describe('UserHandler', () => {
    let userHandler;
    let dbStub;

    beforeEach(() => {
        dbStub = {
            collection: sinon.stub().returns({
                findOne: sinon.stub(),
                insertOne: sinon.stub(),
                updateOne: sinon.stub()
            })
        };

        userHandler = new UserHandler({ database: dbStub });
    });

    describe('create', () => {
        it('should create a new user', async () => {
            const userData = {
                username: 'testuser',
                password: 'hashedpass'
            };

            dbStub.collection('users').insertOne.resolves({
                insertedId: new ObjectId()
            });

            const result = await userHandler.create(userData);

            expect(result).to.have.property('id');
            expect(dbStub.collection.calledWith('users')).to.be.true;
        });
    });
});
```

### Integration Test Pattern

```javascript
// test/integration/api-test.js
const request = require('supertest');
const { expect } = require('chai');

describe('API Integration', () => {
    let app;
    let testUser;

    before(async () => {
        app = require('../../api');

        // Create test user
        testUser = await createTestUser();
    });

    after(async () => {
        // Cleanup
        await deleteTestUser(testUser.id);
    });

    describe('GET /users/:user', () => {
        it('should return user data', async () => {
            const response = await request(app).get(`/users/${testUser.id}`).set('Authorization', `Bearer ${testUser.token}`).expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body.data).to.have.property('username', testUser.username);
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = new ObjectId().toString();

            await request(app).get(`/users/${fakeId}`).set('Authorization', `Bearer ${testUser.token}`).expect(404);
        });
    });
});
```

### IMAP Test Pattern

```javascript
// test/imap/copy-test.js
const { ImapFlow } = require('imapflow');

describe('IMAP COPY Command', () => {
    let client;

    before(async () => {
        client = new ImapFlow({
            host: 'localhost',
            port: 143,
            secure: false,
            auth: {
                user: 'testuser',
                pass: 'testpass'
            }
        });

        await client.connect();
    });

    after(async () => {
        await client.logout();
    });

    it('should copy messages to another mailbox', async () => {
        await client.mailboxOpen('INBOX');

        // Copy messages
        const result = await client.messageMove('1:5', 'Sent');

        expect(result).to.be.true;

        // Verify in target
        await client.mailboxOpen('Sent');
        const messages = await client.search({ all: true });

        expect(messages).to.have.lengthOf.at.least(5);
    });

    it('should return TRYCREATE for non-existent target', async () => {
        await client.mailboxOpen('INBOX');

        try {
            await client.messageCopy('1:5', 'NonExistent');
            throw new Error('Should have failed');
        } catch (err) {
            expect(err.response).to.include('TRYCREATE');
        }
    });
});
```

## Performance Patterns

### Bulk Operations

```javascript
async function bulkUpdateMessages(updates) {
    const operations = updates.map(update => ({
        updateOne: {
            filter: { _id: update.id },
            update: { $set: update.data }
        }
    }));

    const result = await db.database.collection('messages').bulkWrite(operations, { ordered: false });

    return {
        modified: result.modifiedCount,
        errors: result.writeErrors || []
    };
}
```

### Caching Pattern

```javascript
const CACHE_TTL = 300; // 5 minutes

async function getCachedUser(userId) {
    const cacheKey = `user:${userId}`;

    // Check cache
    const cached = await db.redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // Fetch from database
    const user = await db.users.collection('users').findOne({
        _id: new ObjectId(userId)
    });

    if (user) {
        // Store in cache
        await db.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(user));
    }

    return user;
}
```

## Common Utilities

### UID Range Parser

```javascript
function parseUidRange(range) {
    // Parse IMAP UID ranges like "1:5", "1:*", "1,3,5"
    const parts = range.split(',');
    const uids = new Set();

    for (const part of parts) {
        if (part.includes(':')) {
            const [start, end] = part.split(':');
            const startNum = parseInt(start, 10);
            const endNum = end === '*' ? Infinity : parseInt(end, 10);

            for (let i = startNum; i <= endNum && i <= 1000000; i++) {
                uids.add(i);
            }
        } else {
            uids.add(parseInt(part, 10));
        }
    }

    return Array.from(uids).sort((a, b) => a - b);
}
```

### Safe String Escaping

```javascript
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchRegex(searchTerm) {
    const escaped = escapeRegExp(searchTerm);
    return new RegExp(escaped, 'i');
}
```

## Best Practices

1. **Always use maxTimeMS** for database queries to prevent long-running operations
2. **Implement proper error handling** with specific error codes for IMAP responses
3. **Use transactions** for operations that modify multiple collections
4. **Cache frequently accessed data** but always have fallback to database
5. **Validate all input** using Joi schemas for API endpoints
6. **Log all errors** with context for debugging
7. **Use connection pooling** for database connections
8. **Implement rate limiting** for API endpoints
9. **Clean up resources** in finally blocks
10. **Write tests** for all new functionality
