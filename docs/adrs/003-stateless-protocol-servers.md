# ADR-003: Stateless Protocol Server Architecture

## Status
Accepted

## Context
Traditional email servers often maintain state in memory or local files, which creates several operational challenges:
- Difficulty in horizontal scaling due to session affinity
- Complex failover and high availability scenarios
- Resource allocation problems with long-lived connections
- Challenges in load balancing across multiple instances
- Memory leaks and resource cleanup issues

Modern cloud-native applications require stateless designs that can scale horizontally and recover gracefully from failures.

## Decision
We will implement all protocol servers (IMAP, POP3, LMTP, API) as stateless services that:

1. **Store All State Externally**:
   - Session data in Redis
   - User state in MongoDB
   - No local file storage dependencies

2. **Enable Horizontal Scaling**:
   - Any server can handle any user request
   - Load balancers can distribute freely
   - Auto-scaling based on demand

3. **Graceful Failure Handling**:
   - Process restarts don't affect user sessions
   - Connection failures are transparent to clients
   - State recovery from external stores

4. **Resource Efficiency**:
   - Shared resources across protocol servers
   - Memory usage independent of connection count
   - Process-based isolation for stability

## Implementation Details

### Session Management
```javascript
// Redis-based session storage
const session = {
  id: 'sess_' + crypto.randomBytes(16).toString('hex'),
  user: ObjectId('...'),
  created: new Date(),
  lastActivity: new Date(),
  protocol: 'IMAP',
  ip: '192.168.1.100',
  userAgent: 'Thunderbird/78.0',
  selected: ObjectId('...'),  // IMAP selected mailbox
  capabilities: ['IDLE', 'CONDSTORE'],
  ttl: 3600  // Session timeout in seconds
};

await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));
```

### IMAP Stateless Design
```javascript
// IMAP connection handling
class IMAPConnection {
  constructor(socket, server) {
    this.socket = socket;
    this.server = server;
    this.sessionId = null;
    this.authenticated = false;
  }

  async authenticate(username, signature) {
    // Create session in Redis
    const session = await this.createSession(username);
    this.sessionId = session.id;
    this.authenticated = true;
    
    // No local state storage
    return { success: true };
  }

  async selectMailbox(path) {
    // Update session state in Redis
    await this.updateSession({ selected: mailboxId });
    
    // Return mailbox state from MongoDB
    return await this.getMailboxState(mailboxId);
  }
}
```

### POP3 Stateless Implementation
```javascript
// POP3 message marking without local state
class POP3Connection {
  async deleteMessage(messageNum) {
    const session = await this.getSession();
    const message = await this.resolveMessage(messageNum);
    
    // Mark for deletion in database immediately
    await this.markMessageDeleted(session.user, message.id);
    
    // No local DELE tracking needed
    return true;
  }
}
```

### Load Balancer Configuration
```nginx
# Nginx upstream configuration
upstream wildduck_imap {
    least_conn;
    server 10.0.1.10:993;
    server 10.0.1.11:993;
    server 10.0.1.12:993;
}

upstream wildduck_api {
    least_conn;
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
    server 10.0.1.12:8080;
}

# No session affinity needed
proxy_pass http://wildduck_imap;
```

## State Storage Strategy

### Redis Session Store
```javascript
// Session data structure
{
  user: ObjectId,           // User ID
  protocol: String,         // IMAP, POP3, API
  selected: ObjectId,       // IMAP selected mailbox
  capabilities: [String],   // Protocol capabilities
  lastActivity: Date,       // For timeout cleanup
  metadata: {
    ip: String,
    userAgent: String,
    secure: Boolean
  }
}

// Automatic cleanup with TTL
TTL: 3600 seconds (1 hour)
```

### MongoDB Persistent State
```javascript
// User connection tracking
{
  _id: ObjectId,
  user: ObjectId,
  sessions: [{
    id: String,
    protocol: String,
    created: Date,
    lastSeen: Date,
    active: Boolean
  }],
  lastLogin: Date,
  connectionCount: Number
}
```

## Consequences

### Positive
- **Horizontal Scaling**: Linear scaling with additional servers
- **High Availability**: No single points of failure
- **Resource Efficiency**: Predictable resource usage
- **Operational Simplicity**: Standard container deployment patterns
- **Load Distribution**: Even load across all servers
- **Graceful Degradation**: Individual server failures don't affect others

### Negative
- **Network Latency**: Additional network calls to Redis/MongoDB
- **Complexity**: More complex state management
- **External Dependencies**: Redis and MongoDB must be highly available
- **Memory Usage**: Some state duplication across stores

### Performance Considerations
- **Redis Performance**: Sub-millisecond session lookups
- **Connection Pooling**: Shared database connections
- **Caching Strategy**: Local caching for read-heavy operations
- **Network Optimization**: Connection reuse and keep-alive

## Scaling Architecture

### Worker Process Model
```javascript
// server.js - Master process
if (cluster.isMaster) {
  const workers = config.processes || os.cpus().length;
  
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }
} else {
  // worker.js - Protocol servers
  const servers = [
    new IMAPServer(config.imap),
    new POP3Server(config.pop3),
    new APIServer(config.api)
  ];
  
  servers.forEach(server => server.start());
}
```

### Container Deployment
```yaml
# docker-compose.yml
services:
  wildduck:
    image: wildduck:latest
    replicas: 3
    environment:
      - REDIS_URL=redis://redis-cluster:6379
      - MONGO_URL=mongodb://mongo-replica:27017/wildduck
    ports:
      - "993:993"  # IMAP
      - "995:995"  # POP3
      - "8080:8080" # API
```

### Auto-scaling Configuration
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wildduck-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wildduck
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Session Management Details

### Session Creation
```javascript
async createSession(user, protocol, metadata) {
  const session = {
    id: generateSessionId(),
    user: user._id,
    protocol,
    created: new Date(),
    lastActivity: new Date(),
    metadata
  };
  
  // Store in Redis with TTL
  await redis.setex(
    `session:${session.id}`,
    config.sessionTTL,
    JSON.stringify(session)
  );
  
  return session;
}
```

### Session Validation
```javascript
async validateSession(sessionId) {
  const sessionData = await redis.get(`session:${sessionId}`);
  
  if (!sessionData) {
    throw new Error('Session expired');
  }
  
  const session = JSON.parse(sessionData);
  
  // Update last activity
  session.lastActivity = new Date();
  await redis.setex(
    `session:${sessionId}`,
    config.sessionTTL,
    JSON.stringify(session)
  );
  
  return session;
}
```

### Session Cleanup
```javascript
// Automatic cleanup via Redis TTL
// Manual cleanup for monitoring
async cleanupExpiredSessions() {
  const cutoff = new Date(Date.now() - config.sessionTTL * 1000);
  
  // Find expired sessions in tracking
  const expired = await db.sessions.find({
    lastActivity: { $lt: cutoff }
  });
  
  // Remove from Redis and update tracking
  for (const session of expired) {
    await redis.del(`session:${session.id}`);
    await db.sessions.deleteOne({ _id: session._id });
  }
}
```

## Monitoring and Observability

### Health Checks
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connectivity
    await redis.ping();
    
    // Check MongoDB connectivity
    await db.admin().ping();
    
    res.json({ status: 'healthy', timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

### Metrics Collection
```javascript
// Prometheus metrics
const promClient = require('prom-client');

const sessionCount = new promClient.Gauge({
  name: 'wildduck_active_sessions_total',
  help: 'Number of active user sessions',
  labelNames: ['protocol']
});

const requestDuration = new promClient.Histogram({
  name: 'wildduck_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['protocol', 'command']
});
```

## Related ADRs
- ADR-002: MongoDB Storage Architecture
- ADR-004: Redis Clustering Strategy  
- ADR-005: Container Deployment Model