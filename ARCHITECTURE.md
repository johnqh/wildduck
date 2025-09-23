# WildDuck Architecture Documentation

## System Overview

WildDuck is a distributed, scalable email server that stores all data (including emails) in MongoDB and uses Redis for caching and real-time operations.

## Architecture Layers

```mermaid
graph TB
    subgraph "Client Layer"
        IMAP[IMAP Clients]
        POP3[POP3 Clients]
        API[API Clients]
        SMTP[SMTP Clients]
    end

    subgraph "Protocol Layer"
        IMAPS[IMAP Server<br/>:143/:993]
        POP3S[POP3 Server<br/>:110/:995]
        APIS[REST API<br/>:8080]
        LMTPS[LMTP Server<br/>:2424]
    end

    subgraph "Business Logic Layer"
        MH[Message Handler]
        UH[User Handler]
        MBH[Mailbox Handler]
        AH[Auth Handler]
        FH[Filter Handler]
        TH[Task Handler]
    end

    subgraph "Data Layer"
        MongoDB[(MongoDB<br/>Sharded)]
        Redis[(Redis<br/>Cache & Locks)]
        GridFS[(GridFS<br/>Attachments)]
        ES[(ElasticSearch<br/>Optional)]
    end

    IMAP --> IMAPS
    POP3 --> POP3S
    API --> APIS
    SMTP --> LMTPS

    IMAPS --> MH
    IMAPS --> UH
    IMAPS --> MBH
    POP3S --> MH
    POP3S --> AH
    APIS --> UH
    APIS --> MBH
    APIS --> MH
    LMTPS --> MH
    LMTPS --> FH

    MH --> MongoDB
    MH --> GridFS
    MH --> Redis
    UH --> MongoDB
    UH --> Redis
    MBH --> MongoDB
    TH --> MongoDB
    TH --> Redis
    MH -.-> ES
```

## Data Flow Patterns

### 1. Message Reception (LMTP)

```mermaid
sequenceDiagram
    participant MTA as Mail Transfer Agent
    participant LMTP as LMTP Server
    participant FH as Filter Handler
    participant MH as Message Handler
    participant DB as MongoDB
    participant Redis as Redis
    participant Notifier as IMAP Notifier

    MTA->>LMTP: MAIL FROM/RCPT TO
    LMTP->>FH: Check filters
    FH->>DB: Query user filters
    DB-->>FH: Filter rules
    FH-->>LMTP: Accept/Reject
    MTA->>LMTP: DATA (message content)
    LMTP->>MH: Process message
    MH->>DB: Store message
    MH->>DB: Update mailbox counters
    MH->>Redis: Update cache
    MH->>Notifier: Notify IMAP sessions
    Notifier-->>LMTP: Done
    LMTP-->>MTA: 250 OK
```

### 2. IMAP Message Retrieval

```mermaid
sequenceDiagram
    participant Client as IMAP Client
    participant IMAP as IMAP Server
    participant Auth as Auth Handler
    participant MBH as Mailbox Handler
    participant MH as Message Handler
    participant DB as MongoDB
    participant Cache as Redis Cache

    Client->>IMAP: LOGIN
    IMAP->>Auth: Authenticate
    Auth->>DB: Verify credentials
    Auth->>Cache: Create session
    Auth-->>IMAP: Auth success
    IMAP-->>Client: OK LOGIN

    Client->>IMAP: SELECT INBOX
    IMAP->>MBH: Open mailbox
    MBH->>DB: Get mailbox info
    MBH->>Cache: Cache UIDs
    MBH-->>IMAP: Mailbox data
    IMAP-->>Client: EXISTS/RECENT/FLAGS

    Client->>IMAP: FETCH 1:* (BODY)
    IMAP->>MH: Fetch messages
    MH->>Cache: Check cache
    alt Cache miss
        MH->>DB: Query messages
        MH->>Cache: Update cache
    end
    MH-->>IMAP: Message data
    IMAP-->>Client: FETCH response
```

### 3. Message Copy Flow (IMAP COPY)

```mermaid
sequenceDiagram
    participant Client as IMAP Client
    participant Handler as Copy Handler
    participant DB as MongoDB
    participant Quota as Quota Check
    participant Encrypt as Encryption
    participant Notifier as Notifier

    Client->>Handler: COPY 1:5 "Sent"
    Handler->>DB: Check source mailbox
    Handler->>DB: Check target mailbox
    alt Target doesn't exist
        Handler-->>Client: TRYCREATE
    end

    Handler->>Quota: Check user quota
    alt Over quota
        Handler-->>Client: OVERQUOTA
    end

    Handler->>DB: Get messages
    loop For each message
        Handler->>DB: Get next UID
        alt Target encrypted
            Handler->>Encrypt: Encrypt message
        end
        Handler->>DB: Insert message copy
        Handler->>DB: Update counters
    end

    Handler->>Notifier: Fire notifications
    Handler-->>Client: OK [COPYUID ...]
```

## Database Schema Design

### Collections Relationship

```mermaid
erDiagram
    USERS ||--o{ MAILBOXES : has
    USERS ||--o{ MESSAGES : owns
    USERS ||--o{ ADDRESSES : has
    USERS ||--o{ FILTERS : defines
    USERS ||--o{ ASP : creates
    MAILBOXES ||--o{ MESSAGES : contains
    MESSAGES ||--o{ ATTACHMENTS : references
    MESSAGES }o--|| THREADS : "belongs to"

    USERS {
        ObjectId _id PK
        string username UK
        string password
        number quota
        number storageUsed
        date created
        object metadata
    }

    MAILBOXES {
        ObjectId _id PK
        ObjectId user FK
        string path
        number uidNext
        number uidValidity
        string specialUse
        number retention
    }

    MESSAGES {
        ObjectId _id PK
        ObjectId user FK
        ObjectId mailbox FK
        number uid
        number size
        array flags
        date idate
        object mimeTree
        boolean searchable
    }

    ATTACHMENTS {
        ObjectId _id PK
        string hash UK
        number size
        string contentType
        number counter
        object metadata
    }
```

## Component Responsibilities

### Core Services

| Component       | Responsibility                           | Key Files                |
| --------------- | ---------------------------------------- | ------------------------ |
| **IMAP Server** | Handle IMAP protocol, session management | `imap.js`, `imap-core/`  |
| **POP3 Server** | Handle POP3 protocol                     | `pop3.js`, `lib/pop3/`   |
| **LMTP Server** | Receive incoming mail                    | `lmtp.js`                |
| **API Server**  | REST API for management                  | `api.js`, `lib/api/`     |
| **Task Runner** | Background jobs (cleanup, quotas)        | `tasks.js`, `lib/tasks/` |
| **Indexer**     | Search indexing, message parsing         | `indexer.js`             |
| **Notifier**    | Real-time IMAP notifications             | `lib/imap-notifier.js`   |

### Handler Modules

| Handler            | Purpose                    | Database Collections        |
| ------------------ | -------------------------- | --------------------------- |
| **MessageHandler** | Message CRUD operations    | messages, attachments.files |
| **UserHandler**    | User management, auth      | users, addresses            |
| **MailboxHandler** | Mailbox operations         | mailboxes                   |
| **FilterHandler**  | Message filtering          | filters                     |
| **AuditHandler**   | Audit logging              | audit                       |
| **DkimHandler**    | DKIM key management        | dkim                        |
| **CertHandler**    | TLS certificate management | certs                       |

## Scaling Strategy

### Horizontal Scaling

```yaml
# Docker Compose Example
services:
    wildduck-1:
        image: wildduck
        environment:
            - PROCESSES=4
        deploy:
            replicas: 3

    mongodb:
        image: mongo
        command: mongod --shardsvr --replSet shard1
        deploy:
            replicas: 3

    redis:
        image: redis
        command: redis-server --cluster-enabled yes
        deploy:
            replicas: 6
```

### Load Distribution

1. **Process Level**: Multi-process using Node.js cluster
2. **Instance Level**: Multiple WildDuck instances behind load balancer
3. **Database Level**: MongoDB sharding for data distribution
4. **Cache Level**: Redis Cluster for session distribution

## Security Architecture

### Authentication Flow

```mermaid
graph LR
    subgraph "Auth Methods"
        PWD[Password Auth]
        TOTP[TOTP 2FA]
        WA[WebAuthn]
        ASP[App Passwords]
    end

    subgraph "Auth Process"
        AH[Auth Handler]
        CACHE[Session Cache]
        AUDIT[Audit Log]
    end

    subgraph "Storage"
        DB[(User DB)]
        REDIS[(Redis)]
    end

    PWD --> AH
    TOTP --> AH
    WA --> AH
    ASP --> AH

    AH --> DB
    AH --> CACHE
    AH --> AUDIT

    CACHE --> REDIS
    AUDIT --> DB
```

### Encryption Layers

1. **Transport**: TLS/SSL for all protocols
2. **Storage**: Optional PGP encryption for messages
3. **Passwords**: PBKDF2/bcrypt hashing
4. **Tokens**: Encrypted with configurable secret
5. **Attachments**: Deduplicated and optionally encrypted

## Performance Optimizations

### Caching Strategy

| Cache Type   | Location | TTL       | Purpose              |
| ------------ | -------- | --------- | -------------------- |
| Session      | Redis    | 1 hour    | User sessions        |
| Mailbox      | Redis    | 5 min     | Mailbox metadata     |
| Message list | Redis    | 1 min     | UID lists            |
| User data    | Memory   | 30 sec    | Frequent lookups     |
| Attachment   | GridFS   | Permanent | Deduplicated storage |

### Database Indexes

Critical indexes for performance:

- `users`: username, address
- `messages`: mailbox+uid, user+searchable
- `mailboxes`: user+path
- `attachments.files`: hash

## Monitoring Points

### Key Metrics

```javascript
// Health check endpoints
GET /health         // Basic health
GET /health/details // Detailed status

// Metrics to monitor
{
    "connections": {
        "imap": 125,
        "pop3": 23,
        "api": 45
    },
    "database": {
        "connected": true,
        "latency": 2.5
    },
    "redis": {
        "connected": true,
        "memory": "125MB"
    },
    "queues": {
        "tasks": 12,
        "webhooks": 3
    },
    "storage": {
        "used": "45.2GB",
        "attachments": 125000
    }
}
```

## Deployment Considerations

### Minimum Requirements

- **MongoDB**: 4.0+ with replica set
- **Redis**: 5.0+ (6.0+ for ACLs)
- **Node.js**: 16.0+
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: SSD recommended for database

### Production Checklist

- [ ] Configure MongoDB replica set
- [ ] Enable MongoDB authentication
- [ ] Setup Redis persistence
- [ ] Configure TLS certificates
- [ ] Set user/group for process
- [ ] Configure log rotation
- [ ] Setup monitoring
- [ ] Configure backups
- [ ] Set resource limits
- [ ] Enable audit logging

## Extension Points

### Plugin System

```javascript
// Plugin structure
module.exports = {
    title: 'My Plugin',
    init: (app, done) => {
        // Plugin initialization
        done();
    },
    hooks: {
        'message:store': (envelope, body, next) => {
            // Process message before storage
            next();
        },
        'user:created': (user, next) => {
            // Handle new user
            next();
        }
    }
};
```

### Custom Handlers

Add custom IMAP commands:

1. Create handler in `lib/handlers/`
2. Register in `imap.js`
3. Add tests in `test/`

### API Extensions

Add new API endpoints:

1. Create handler in `lib/api/`
2. Define schemas in `lib/schemas/`
3. Update OpenAPI documentation
