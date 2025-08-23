# ADR-002: MongoDB-Based Storage Architecture

## Status
Accepted

## Context
Traditional email servers store emails as files on the filesystem, which presents several challenges:
- File system limitations (number of files per directory, file name restrictions)
- Difficulty in implementing complex queries and indexing
- Challenges with horizontal scaling and replication
- Complex backup and recovery procedures
- Limited metadata storage and searching capabilities

Modern email systems require advanced features like full-text search, real-time synchronization, and horizontal scaling that are difficult to achieve with file-based storage.

## Decision
We will use MongoDB as the primary storage backend for all email data, implementing a document-based email storage system with the following characteristics:

1. **Document Storage Model**:
   - Each email message is stored as a MongoDB document
   - Headers, content, and metadata in structured format
   - Attachment deduplication using GridFS

2. **Collection Structure**:
   - `users`: User accounts and settings
   - `addresses`: Email addresses and forwarding rules
   - `mailboxes`: IMAP folder structure
   - `messages`: Email messages and metadata
   - `journal`: Audit logs and events
   - `authlog`: Authentication attempts

3. **Indexing Strategy**:
   - Compound indexes for common query patterns
   - Text indexes for full-text search
   - TTL indexes for automatic cleanup

4. **Attachment Handling**:
   - GridFS for large attachments
   - SHA-256 based deduplication
   - Separate metadata and content storage

## Implementation Details

### Message Storage Schema
```javascript
{
  _id: ObjectId,
  user: ObjectId,          // Reference to user
  mailbox: ObjectId,       // Reference to mailbox
  uid: Number,             // IMAP UID
  modseq: Number,          // Modification sequence
  idate: Date,             // Internal date
  hdate: Date,             // Header date
  subject: String,         // Message subject
  msgid: String,           // Message-ID header
  thread: ObjectId,        // Thread grouping
  flags: [String],         // IMAP flags
  headers: [{              // All headers
    key: String,
    line: String,
    value: String
  }],
  text: String,            // Plain text body
  html: [String],          // HTML body parts
  attachments: [{          // Attachment metadata
    id: ObjectId,
    filename: String,
    contentType: String,
    size: Number,
    hash: String
  }],
  size: Number,            // Total message size
  map: Object              // BODYSTRUCTURE map
}
```

### Index Strategy
```javascript
// Primary query indexes
{ user: 1, mailbox: 1, uid: 1 }      // Message retrieval
{ user: 1, mailbox: 1, modseq: 1 }   // IMAP CONDSTORE
{ user: 1, mailbox: 1, thread: 1 }   // Threading
{ user: 1, idate: -1 }               // Recent messages
{ msgid: 1 }                         // Duplicate detection

// Search indexes
{ user: 1, "headers.key": 1, "headers.value": 1 }  // Header search
{ user: 1, text: "text" }            // Full-text search
{ user: 1, subject: "text" }         // Subject search

// Cleanup indexes
{ exp: 1, expireAt: 1 }              // TTL for expired messages
```

### Attachment Deduplication
```javascript
// Attachment storage process
1. Calculate SHA-256 hash of attachment content
2. Check if hash exists in GridFS
3. If exists, reference existing file
4. If new, store in GridFS with hash-based filename
5. Store metadata in message document
```

## Performance Considerations

### Read Optimization
- Compound indexes for common IMAP operations
- Projection queries to minimize data transfer
- Connection pooling for concurrent access
- Read preferences for replica set optimization

### Write Optimization
- Bulk operations for message imports
- Upsert operations for idempotent updates
- Write concerns for durability vs. performance
- Sharding strategy for horizontal scaling

### Memory Management
- Document size limits (16MB MongoDB limit)
- Large content stored in GridFS
- Efficient cursor handling for large result sets
- Aggregation pipeline for complex queries

## Consequences

### Positive
- **Query Flexibility**: Complex searches and aggregations
- **Scalability**: Horizontal scaling with sharding
- **Consistency**: ACID transactions for critical operations
- **Backup/Recovery**: Built-in replication and backup tools
- **Real-time Features**: Change streams for live updates
- **Schema Evolution**: Document flexibility for feature additions

### Negative
- **Memory Usage**: Higher memory requirements than filesystem
- **Complex Queries**: Learning curve for MongoDB operations
- **Backup Size**: Potentially larger backup files
- **Migration Complexity**: Moving from traditional mail stores

### Performance Trade-offs
- **Fast Queries**: Excellent for searches and filters
- **Slower Sequential Access**: Compared to mbox format
- **Index Overhead**: Storage overhead for indexes
- **Network Latency**: Database queries vs. local file access

## Alternatives Considered

### Traditional Maildir/mbox
- **Pros**: Simple, well-understood, file-based
- **Cons**: Limited querying, scaling challenges, no real-time features
- **Decision**: Rejected due to modern requirements

### PostgreSQL with JSONB
- **Pros**: ACID compliance, mature, SQL queries
- **Cons**: Less flexible schema, complex JSON queries
- **Decision**: MongoDB chosen for document-native approach

### Elasticsearch
- **Pros**: Excellent search capabilities, horizontal scaling
- **Cons**: Not designed for transactional email operations
- **Decision**: Used as optional search enhancement, not primary storage

### Cassandra
- **Pros**: Excellent write performance, horizontal scaling
- **Cons**: Limited query flexibility, eventual consistency
- **Decision**: Rejected due to email system consistency requirements

## Migration Strategy

### From Existing Mail Stores
1. **Assessment**: Analyze existing mail storage format
2. **Import Tools**: Develop maildir/mbox import utilities
3. **Batch Processing**: Import messages in manageable chunks
4. **Verification**: Validate message integrity after import
5. **Cutover**: Switch to MongoDB storage

### Data Migration Tools
```bash
# Maildir import
node import-maildir.js --source /var/mail/users --user userid

# mbox import  
node import-mbox.js --file /var/mail/username --user userid

# IMAP migration
node import-imap.js --host oldserver --user username --pass password
```

## Monitoring and Operations

### Performance Metrics
- Query response times by operation type
- Index hit ratios and scan patterns
- Connection pool utilization
- Storage growth and fragmentation

### Operational Procedures
- Regular index analysis and optimization
- Backup and recovery testing
- Replica set maintenance
- Sharding key evaluation and rebalancing

## Security Considerations

### Data Protection
- Encryption at rest with MongoDB encryption
- TLS for client-server communication
- Access control with role-based authentication
- Audit logging for administrative operations

### PII Handling
- Email content encryption options
- Compliance with data retention policies
- Right-to-be-forgotten implementation
- Data export/import capabilities

## Related ADRs
- ADR-003: Attachment Deduplication Strategy
- ADR-004: Search Engine Integration
- ADR-005: Horizontal Scaling Architecture