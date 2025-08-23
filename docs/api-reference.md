# WildDuck API Reference

This comprehensive API reference provides detailed information about all WildDuck REST API endpoints, optimized for AI-assisted development.

## Base URL and Authentication

```
Base URL: https://your-domain.com/api
Authentication: Bearer token in Authorization header
```

## Common Response Format

All API responses follow a consistent structure:

```json
{
    "success": true,
    "id": "507f1f77bcf86cd799439011",
    "data": { /* response data */ },
    "error": "Error message if success is false",
    "code": "ERROR_CODE"
}
```

## User Management API

### Create User

Creates a new user account with optional blockchain authentication support.

```http
POST /users
```

**Request Body:**

```json
{
    "username": "user@example.com",
    "name": "John Doe",
    "quota": 1073741824,
    "retention": 0,
    "enabled": true,
    "encryptMessages": false,
    "encryptForwarded": false,
    "pubKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----...",
    "language": "en",
    "sess": "session-id",
    "ip": "192.168.1.1",
    "tags": ["premium", "enterprise"],
    "metaData": {
        "source": "api",
        "plan": "premium"
    },
    "internalData": {
        "customerId": "cust_123456"
    },
    "featureFlags": ["indexing"]
}
```

**Response:**

```json
{
    "success": true,
    "id": "507f1f77bcf86cd799439011"
}
```

### List Users

Retrieves a paginated list of users with filtering options.

```http
GET /users?query=search&limit=20&next=cursor
```

**Query Parameters:**

- `query` (string): Search term for username or email
- `forward` (string): Filter by forwarding address
- `tags` (string): Comma-separated list of tags (ANY match)
- `requiredTags` (string): Comma-separated list of tags (ALL required)
- `metaData` (boolean): Include metadata in response
- `internalData` (boolean): Include internal data (admin only)
- `limit` (number): Results per page (1-250, default: 20)
- `next` (string): Next page cursor
- `previous` (string): Previous page cursor

**Response:**

```json
{
    "success": true,
    "total": 1500,
    "page": 1,
    "pages": 75,
    "nextCursor": "eyJfaWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ",
    "results": [
        {
            "id": "507f1f77bcf86cd799439011",
            "username": "user@example.com",
            "name": "John Doe",
            "address": "user@example.com",
            "quota": 1073741824,
            "storageUsed": 268435456,
            "enabled": true,
            "suspended": false,
            "created": "2025-01-01T00:00:00.000Z"
        }
    ]
}
```

### Get User Details

Retrieves detailed information about a specific user.

```http
GET /users/:id
```

**Path Parameters:**

- `id` (string): User ID or username

**Response:**

```json
{
    "success": true,
    "id": "507f1f77bcf86cd799439011",
    "username": "user@example.com",
    "name": "John Doe",
    "address": "user@example.com",
    "quota": 1073741824,
    "storageUsed": 268435456,
    "enabled": true,
    "suspended": false,
    "created": "2025-01-01T00:00:00.000Z",
    "retention": 0,
    "hasPasswordSet": false,
    "activated": true,
    "disabled2fa": false,
    "encryptMessages": false,
    "encryptForwarded": false,
    "language": "en",
    "featureFlags": ["indexing"],
    "tags": ["premium"],
    "metaData": {
        "source": "api"
    }
}
```

### Update User

Updates user account information.

```http
PUT /users/:id
```

**Request Body:**

```json
{
    "name": "Updated Name",
    "quota": 2147483648,
    "retention": 30,
    "enabled": true,
    "suspended": false,
    "encryptMessages": true,
    "language": "es",
    "tags": ["premium", "vip"],
    "metaData": {
        "lastUpdate": "2025-01-01T00:00:00.000Z"
    }
}
```

### Delete User

Permanently deletes a user account and all associated data.

```http
DELETE /users/:id
```

**Query Parameters:**

- `deleteAfter` (string): ISO date string for delayed deletion

## Authentication API

### Blockchain Authentication

Authenticates users using blockchain signatures (EVM, Solana, ENS, SNS).

```http
POST /authenticate
```

**Request Body:**

```json
{
    "username": "vitalik.eth",
    "signature": "0x1234567890abcdef...",
    "nonce": "random-nonce-string",
    "create": true,
    "scope": "master",
    "sess": "session-id",
    "ip": "192.168.1.1"
}
```

**Response:**

```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": "507f1f77bcf86cd799439011",
        "username": "vitalik.eth",
        "scope": "master"
    }
}
```

### Generate Authentication Token

Creates an API access token for programmatic access.

```http
POST /users/:id/tokens
```

**Request Body:**

```json
{
    "description": "Mobile app access",
    "scopes": ["imap", "pop3"],
    "restrictions": {
        "ips": ["192.168.1.0/24"],
        "expire": "2025-12-31T23:59:59.000Z"
    }
}
```

## Address Management API

### List User Addresses

Retrieves all email addresses associated with a user.

```http
GET /users/:id/addresses
```

**Response:**

```json
{
    "success": true,
    "results": [
        {
            "id": "507f1f77bcf86cd799439012",
            "name": "John Doe",
            "address": "user@example.com",
            "main": true,
            "created": "2025-01-01T00:00:00.000Z"
        },
        {
            "id": "507f1f77bcf86cd799439013",
            "name": "J. Doe",
            "address": "john.doe@example.com",
            "main": false,
            "created": "2025-01-02T00:00:00.000Z"
        }
    ]
}
```

### Create Address

Adds a new email address to a user account.

```http
POST /users/:id/addresses
```

**Request Body:**

```json
{
    "address": "new.address@example.com",
    "name": "New Address",
    "main": false,
    "metaData": {
        "purpose": "newsletters"
    }
}
```

### Create Forwarding Address

Creates an address that forwards emails to external destinations.

```http
POST /addresses/forwarded
```

**Request Body:**

```json
{
    "address": "forward@example.com",
    "name": "Forwarding Address",
    "targets": [
        {
            "type": "relay",
            "value": "external@domain.com"
        },
        {
            "type": "http",
            "value": "https://webhook.example.com/incoming"
        }
    ],
    "forwardedDisabled": false,
    "autoreply": {
        "status": true,
        "subject": "Auto Reply",
        "text": "Thank you for your message.",
        "html": "<p>Thank you for your message.</p>"
    }
}
```

## Mailbox Management API

### List Mailboxes

Retrieves all mailboxes for a user.

```http
GET /users/:id/mailboxes
```

**Query Parameters:**

- `specialUse` (boolean): Include special-use flags
- `hidden` (boolean): Include hidden mailboxes
- `subscribed` (boolean): Filter by subscription status

**Response:**

```json
{
    "success": true,
    "results": [
        {
            "id": "507f1f77bcf86cd799439014",
            "name": "INBOX",
            "path": "INBOX",
            "specialUse": "\\Inbox",
            "modifyIndex": 12345,
            "subscribed": true,
            "total": 150,
            "unseen": 5,
            "size": 52428800
        }
    ]
}
```

### Create Mailbox

Creates a new IMAP mailbox.

```http
POST /users/:id/mailboxes
```

**Request Body:**

```json
{
    "path": "Projects/Important",
    "hidden": false,
    "retention": 0
}
```

### Update Mailbox

Updates mailbox properties.

```http
PUT /users/:id/mailboxes/:mailboxId
```

**Request Body:**

```json
{
    "path": "Projects/Very Important",
    "retention": 30,
    "subscribed": true
}
```

## Message Management API

### List Messages

Retrieves messages from a mailbox with advanced filtering.

```http
GET /users/:id/mailboxes/:mailboxId/messages
```

**Query Parameters:**

- `limit` (number): Messages per page (1-250, default: 20)
- `order` (string): Sort order ("asc" or "desc", default: "desc")
- `next` (string): Next page cursor
- `previous` (string): Previous page cursor
- `unseen` (boolean): Filter by read status
- `flagged` (boolean): Filter by flagged status
- `from` (string): Filter by sender address
- `to` (string): Filter by recipient address
- `subject` (string): Filter by subject line
- `datestart` (string): Start date (ISO format)
- `dateend` (string): End date (ISO format)
- `minSize` (number): Minimum message size in bytes
- `maxSize` (number): Maximum message size in bytes
- `thread` (string): Thread ID for conversation view
- `includeHeaders` (boolean): Include message headers

**Response:**

```json
{
    "success": true,
    "total": 1500,
    "page": 1,
    "pages": 75,
    "nextCursor": "eyJfaWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTUifQ",
    "results": [
        {
            "id": "507f1f77bcf86cd799439015",
            "uid": 12345,
            "date": "2025-01-01T12:00:00.000Z",
            "idate": "2025-01-01T12:00:00.000Z",
            "size": 15360,
            "subject": "Important Message",
            "from": {
                "name": "Sender Name",
                "address": "sender@example.com"
            },
            "to": [
                {
                    "name": "Recipient Name",
                    "address": "recipient@example.com"
                }
            ],
            "messageId": "<message-id@example.com>",
            "flags": ["\\Seen", "\\Flagged"],
            "labels": ["Important", "Work"],
            "attachments": true,
            "contentType": {
                "value": "multipart/mixed"
            }
        }
    ]
}
```

### Get Message Details

Retrieves full message content and metadata.

```http
GET /users/:id/mailboxes/:mailboxId/messages/:messageId
```

**Query Parameters:**

- `markAsSeen` (boolean): Mark message as read
- `embedAttachedImages` (boolean): Embed images in HTML

**Response:**

```json
{
    "success": true,
    "id": "507f1f77bcf86cd799439015",
    "uid": 12345,
    "date": "2025-01-01T12:00:00.000Z",
    "subject": "Important Message",
    "from": {
        "name": "Sender Name",
        "address": "sender@example.com"
    },
    "to": [
        {
            "name": "Recipient Name",
            "address": "recipient@example.com"
        }
    ],
    "headers": [
        {
            "key": "received",
            "line": "Received: from mail.example.com...",
            "value": "from mail.example.com"
        }
    ],
    "text": "Plain text content",
    "html": ["<p>HTML content</p>"],
    "attachments": [
        {
            "id": "507f1f77bcf86cd799439016",
            "filename": "document.pdf",
            "contentType": "application/pdf",
            "size": 1048576,
            "hash": "sha256:abc123..."
        }
    ],
    "flags": ["\\Seen"],
    "labels": ["Important"]
}
```

### Submit Message

Sends a new email message.

```http
POST /users/:id/submit
```

**Request Body:**

```json
{
    "from": {
        "name": "Sender Name",
        "address": "sender@example.com"
    },
    "to": [
        {
            "name": "Recipient Name",
            "address": "recipient@example.com"
        }
    ],
    "cc": [],
    "bcc": [],
    "subject": "Message Subject",
    "text": "Plain text content",
    "html": "<p>HTML content</p>",
    "attachments": [
        {
            "filename": "attachment.txt",
            "content": "base64-encoded-content",
            "contentType": "text/plain"
        }
    ],
    "headers": {
        "X-Custom-Header": "Custom Value"
    },
    "sendTime": "2025-01-01T12:00:00.000Z",
    "deliveryReport": true,
    "readReceipt": true
}
```

### Upload Attachment

Uploads a file attachment for use in messages.

```http
POST /users/:id/attachment
```

**Request:** Multipart form data with file field

**Response:**

```json
{
    "success": true,
    "id": "507f1f77bcf86cd799439016",
    "filename": "document.pdf",
    "contentType": "application/pdf",
    "size": 1048576
}
```

## Filter Management API

### List Filters

Retrieves server-side email filters for a user.

```http
GET /users/:id/filters
```

**Response:**

```json
{
    "success": true,
    "results": [
        {
            "id": "507f1f77bcf86cd799439017",
            "name": "Spam Filter",
            "query": {
                "from": "spam@*"
            },
            "action": {
                "mailbox": "507f1f77bcf86cd799439018",
                "seen": true
            },
            "disabled": false,
            "created": "2025-01-01T00:00:00.000Z"
        }
    ]
}
```

### Create Filter

Creates a new server-side email filter.

```http
POST /users/:id/filters
```

**Request Body:**

```json
{
    "name": "Important Emails",
    "query": {
        "from": "boss@company.com",
        "or": {
            "subject": "urgent"
        }
    },
    "action": {
        "mailbox": "507f1f77bcf86cd799439014",
        "seen": false,
        "flag": true,
        "forward": "mobile@example.com"
    },
    "disabled": false
}
```

## Storage Management API

### Get Storage Usage

Retrieves detailed storage usage information.

```http
GET /users/:id/storage
```

**Response:**

```json
{
    "success": true,
    "storageUsed": 1073741824,
    "quota": 2147483648,
    "storagePercentage": 50,
    "breakdown": {
        "messages": 536870912,
        "attachments": 536870912
    },
    "mailboxes": [
        {
            "id": "507f1f77bcf86cd799439014",
            "path": "INBOX",
            "storageUsed": 268435456,
            "messages": 150
        }
    ]
}
```

## Audit and Security API

### Get Audit Log

Retrieves security and activity audit logs.

```http
GET /users/:id/audit
```

**Query Parameters:**

- `action` (string): Filter by action type
- `start` (string): Start date (ISO format)
- `end` (string): End date (ISO format)
- `limit` (number): Results per page

**Response:**

```json
{
    "success": true,
    "total": 100,
    "results": [
        {
            "id": "507f1f77bcf86cd799439019",
            "action": "authentication",
            "result": "success",
            "sess": "session-id",
            "ip": "192.168.1.1",
            "created": "2025-01-01T12:00:00.000Z",
            "meta": {
                "protocol": "IMAP",
                "userAgent": "Thunderbird"
            }
        }
    ]
}
```

## Error Codes

Common API error codes and their meanings:

| Code | Status | Description |
|------|--------|-------------|
| `UserNotFound` | 404 | User account does not exist |
| `AddressExists` | 409 | Email address already registered |
| `QuotaExceeded` | 413 | Storage quota exceeded |
| `InvalidCredentials` | 401 | Invalid authentication signature |
| `RateLimitExceeded` | 429 | Too many requests |
| `InsufficientPermissions` | 403 | Access denied |
| `InvalidSignature` | 400 | Blockchain signature verification failed |
| `MailboxNotFound` | 404 | Mailbox does not exist |
| `MessageNotFound` | 404 | Message does not exist |
| `InvalidData` | 400 | Request validation failed |

## Rate Limiting

API endpoints are rate-limited based on:

- **Per IP**: 2400 requests per hour
- **Per User**: 1000 requests per hour  
- **Per Token**: Based on token permissions

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 2400
X-RateLimit-Remaining: 2350
X-RateLimit-Reset: 1609459200
```

## WebSockets API

Real-time event subscriptions:

```javascript
const ws = new WebSocket('wss://your-domain.com/api/events');

ws.send(JSON.stringify({
    action: 'subscribe',
    user: 'user-id',
    events: ['messageNew', 'messageDeleted', 'quotaUpdated']
}));

// Event format
{
    "event": "messageNew",
    "user": "507f1f77bcf86cd799439011",
    "data": {
        "mailbox": "507f1f77bcf86cd799439014",
        "message": "507f1f77bcf86cd799439015"
    }
}
```