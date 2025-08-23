# WildDuck Configuration Guide

This comprehensive guide covers all configuration options for WildDuck email server, optimized for AI-assisted development and deployment.

## Configuration Architecture

WildDuck uses the `wild-config` library with TOML configuration files. Configuration is hierarchical with environment-specific overrides.

### Configuration File Structure

```
config/
├── default.toml          # Base configuration
├── dbs.toml             # Database connections
├── attachments.toml     # Attachment storage
├── api.toml             # REST API settings
├── imap.toml            # IMAP server settings
├── pop3.toml            # POP3 server settings
├── lmtp.toml            # LMTP server settings
├── acme.toml            # ACME/SSL settings
├── dkim.toml            # DKIM signing
├── sender.toml          # Outbound email
├── tls.toml             # TLS certificates
├── plugins.toml         # Plugin configuration
├── test.toml            # Test environment overrides
└── roles.json           # Access control roles
```

## Core Configuration (`default.toml`)

### Process Management

```toml
# Process identity (for service management)
ident = "wildduck"

# Number of worker processes
# Values: number or "cpus" for CPU count
processes = 1

# User/group downgrade (if starting as root)
#user = "wildduck"
#group = "wildduck"

# Default email domain for non-email usernames
#emailDomain = "mydomain.info"

# Mail Box Indexer service URL for signature verification
mailBoxIndexerUrl = "http://localhost:42069"
```

### Logging Configuration

```toml
[log]
# Log levels: error, warn, info, verbose, debug, silly
level = "info"

# Skip individual FETCH responses (reduces verbosity)
skipFetchLog = false

# Authentication log retention (days)
authlogTime = 30

# GELF logging for centralized log management
[log.gelf]
enabled = false
component = "wildduck"
hostname = "localhost"
host = "127.0.0.1"
port = 12201
facility = "wildduck"
```

## Database Configuration (`dbs.toml`)

### MongoDB Settings

```toml
# Primary database connection
mongo = "mongodb://127.0.0.1:27017/wildduck"

# Separate databases (optional)
users = "mongodb://127.0.0.1:27017/wildduck"      # User data
gridfs = "mongodb://127.0.0.1:27017/wildduck"     # File storage
sender = "mongodb://127.0.0.1:27017/zone-mta"     # Outbound queue

# Connection options
[mongo.options]
maxPoolSize = 100
minPoolSize = 5
maxIdleTimeMS = 30000
serverSelectionTimeoutMS = 5000
```

### Redis Configuration

```toml
# Redis connection for caching and sessions
redis = "redis://127.0.0.1:6379/2"

# Redis Sentinel support
#redisSentinels = [
#    { host = "127.0.0.1", port = 26379 },
#    { host = "127.0.0.1", port = 26380 }
#]
#redisSentinelName = "mymaster"

# Redis options
[redis.options]
retryDelayOnFailover = 100
enableReadyCheck = false
lazyConnect = true
```

## Protocol Server Configuration

### IMAP Server (`imap.toml`)

```toml
enabled = true
port = 9993
host = "0.0.0.0"
secure = true

# Security settings
useProxy = false         # Trust X-Forwarded-For headers
ignoreTLS = false       # Allow plaintext authentication
starttls = false        # Require STARTTLS

# Connection limits
maxConnections = 2000
maxConnections_per_ip = 15

# Performance tuning
compression = false     # Enable DEFLATE compression
enableFutureRelease = false  # RFC 8474 support

# Banner customization
disableVersionHeader = false

# Advanced IMAP features
[imap.retain]
# Message retention (days) - 0 = no retention
time = 0

[imap.setup]
# Auto-create default mailboxes
folders = [
    { path = "INBOX" },
    { path = "Sent", specialUse = "Sent" },
    { path = "Trash", specialUse = "Trash" },
    { path = "Junk", specialUse = "Junk" },
    { path = "Drafts", specialUse = "Drafts" }
]
```

### POP3 Server (`pop3.toml`)

```toml
enabled = true
port = 9995
host = "0.0.0.0"
secure = true

# Connection limits
maxConnections = 1000
maxConnections_per_ip = 10

# Security
useProxy = false
ignoreTLS = false
starttls = false
disableVersionHeader = false

# POP3-specific settings
deleteMessage = true    # Delete messages after retrieval
```

### API Server (`api.toml`)

```toml
enabled = true
port = 8080
host = "0.0.0.0"
secure = false

# Security headers
disableVersionHeader = false

# CORS configuration
[api.accessControl]
allowOrigin = "*"
allowMethods = "GET, POST, PUT, DELETE, OPTIONS"
allowHeaders = "content-type, authorization"

# Rate limiting
[api.rateLimit]
# API calls per hour per IP
limit = 2400
windowSize = 3600

# File upload limits
[api.upload]
# Maximum file size (bytes)
maxSize = 52428800  # 50MB
# Allowed MIME types
allowedTypes = ["image/*", "application/pdf"]
```

### LMTP Server (`lmtp.toml`)

```toml
enabled = false
port = 2424
host = "127.0.0.1"
maxConnections = 1000
banner = "WildDuck LMTP Server"

# Performance
maxSize = 52428800  # 50MB max message size
```

## Security Configuration

### TLS Certificates (`tls.toml`)

```toml
# Default TLS settings
[tls.default]
key = "/path/to/private.key"
cert = "/path/to/certificate.crt"
ca = ["/path/to/ca.crt"]  # Certificate chain

# Protocol-specific certificates
[tls.imap]
key = "/path/to/imap.key"
cert = "/path/to/imap.crt"

[tls.pop3]
key = "/path/to/pop3.key"
cert = "/path/to/pop3.crt"

[tls.api]
key = "/path/to/api.key"
cert = "/path/to/api.crt"

# Cipher suite configuration
ciphers = "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384"
honorCipherOrder = true
secureProtocol = "TLSv1_2_method"
```

### ACME/Let's Encrypt (`acme.toml`)

```toml
enabled = false
port = 80
host = "0.0.0.0"

# ACME directory URL
directoryUrl = "https://acme-v02.api.letsencrypt.org/directory"
# directoryUrl = "https://acme-staging-v02.api.letsencrypt.org/directory"  # Staging

# Contact email for Let's Encrypt
email = "admin@example.com"

# Certificate storage
[acme.storage]
type = "fs"
path = "/var/lib/wildduck/certs"

# Auto-renewal settings
[acme.renewal]
daysBeforeExpiry = 30
checkInterval = 86400  # 24 hours in seconds
```

### DKIM Signing (`dkim.toml`)

```toml
enabled = true

# Default DKIM settings
[dkim.default]
domainName = "example.com"
keySelector = "wildduck"
privateKey = "/path/to/dkim/private.key"
skipDomains = ["example.org"]  # Domains to skip DKIM

# Per-domain DKIM settings
[dkim.domains.example.com]
keySelector = "mail"
privateKey = "/path/to/example.com.key"

[dkim.domains.another.com]
keySelector = "default"
privateKey = "/path/to/another.com.key"
```

## Storage Configuration

### Attachment Storage (`attachments.toml`)

```toml
# Storage backend: "gridstore" or "s3"
type = "gridstore"

# GridFS settings (MongoDB)
[attachments.gridstore]
bucket = "attachments"
decodeBase64 = false

# S3 settings (AWS, MinIO, etc.)
[attachments.s3]
bucket = "wildduck-attachments"
region = "us-east-1"
endpoint = "https://s3.amazonaws.com"
accessKeyId = "your-access-key"
secretAccessKey = "your-secret-key"
prefix = "attachments/"

# Deduplication settings
[attachments.dedup]
enabled = true
algorithm = "sha256"
```

### Elasticsearch Integration

```toml
[elasticsearch]
enabled = false
host = "127.0.0.1:9200"
index = "wildduck"
authEnabled = false
# auth = { username = "elastic", password = "changeme" }

# Index mapping settings
[elasticsearch.settings]
indexing = {
    maxBulkSize = 100,
    bulkFlushInterval = 5000,
    maxRetries = 3
}
```

## Mail Box Indexer Configuration

WildDuck can be configured to use an external mail_box_indexer service for blockchain signature verification:

```toml
# Mail Box Indexer service URL for signature verification
mailBoxIndexerUrl = "http://localhost:42069"
```

### Environment Variable Override

```bash
# Override in environment
export MAIL_BOX_INDEXER_URL="https://indexer.yourdomain.com"
```

### Service Requirements

The mail_box_indexer service must provide:
- **POST** `/verify` endpoint for signature verification
- Support for EVM (Ethereum) and Solana signatures
- Request format: `{ walletAddress, signature, message }`
- Response format: `{ isValid: boolean, addressType: string }`

### Error Handling

WildDuck handles mail_box_indexer service failures gracefully:
- Connection refused: Clear error about service unavailability
- HTTP errors: Detailed error messages from service response
- Network timeouts: 10-second timeout with descriptive errors

## Plugin Configuration (`plugins.toml`)

```toml
# Plugin directory
pluginDir = "./plugins"

# Core plugins
[plugins.rspamd]
enabled = false
host = "127.0.0.1"
port = 11334
authPassword = "changeme"

[plugins.clamav]
enabled = false
host = "127.0.0.1"
port = 3310
timeout = 30000

# Custom plugin settings
[plugins.custom]
enabled = false
module = "./plugins/custom.js"
settings = { key = "value" }
```

## Access Control (`roles.json`)

```json
{
    "roles": [
        {
            "role": "admin",
            "description": "Full system access",
            "permissions": ["*"]
        },
        {
            "role": "user",
            "description": "User account management",
            "permissions": [
                "users:read",
                "users:update:own",
                "messages:read:own",
                "mailboxes:read:own"
            ]
        },
        {
            "role": "api",
            "description": "API access only",
            "permissions": [
                "users:read",
                "users:create",
                "messages:create"
            ]
        }
    ],
    "resources": {
        "users": ["read", "create", "update", "delete"],
        "messages": ["read", "create", "update", "delete"],
        "mailboxes": ["read", "create", "update", "delete"],
        "settings": ["read", "update"]
    }
}
```

## Environment-Specific Configuration

### Development (`NODE_ENV=development`)

```toml
# Override default settings for development
[log]
level = "debug"
skipFetchLog = false

[imap]
port = 1143
secure = false

[pop3]
port = 1110
secure = false

[api]
port = 3000
secure = false

# Development database
[dbs]
mongo = "mongodb://127.0.0.1:27017/wildduck-dev"
redis = "redis://127.0.0.1:6379/3"
```

### Testing (`NODE_ENV=test`)

```toml
# Test environment settings
[log]
level = "error"

# Test databases
[dbs]
mongo = "mongodb://127.0.0.1:27017/wildduck-test"
redis = "redis://127.0.0.1:6379/13"

# Disable external services
[acme]
enabled = false

[plugins.rspamd]
enabled = false
```

### Production (`NODE_ENV=production`)

```toml
# Production optimizations
processes = "cpus"

[log]
level = "info"
skipFetchLog = true

# Production security
[imap]
ignoreTLS = false
useProxy = true

[api]
rateLimit = { limit = 1000, windowSize = 3600 }

# Monitoring and health checks
[monitoring]
enabled = true
healthCheck = { path = "/health", port = 8081 }
metrics = { enabled = true, path = "/metrics" }
```

## Configuration Validation

WildDuck validates configuration on startup. Common validation rules:

- **Port conflicts**: No two services can use the same port
- **Database connectivity**: All database URLs must be accessible
- **TLS certificates**: Certificate files must exist and be valid
- **Plugin dependencies**: Plugin modules must be available
- **Access control**: Role permissions must reference valid resources

## Configuration Helpers

### Environment Variables

```bash
# Override any config value with environment variables
WILDDUCK_IMAP_PORT=993
WILDDUCK_API_SECURE=true
WILDDUCK_DBS_MONGO="mongodb://mongo-server:27017/wildduck"
```

### Configuration Validation Script

```javascript
// scripts/validate-config.js
const config = require('wild-config');
const fs = require('fs');

// Validate TLS certificates
if (config.tls?.default?.cert) {
    if (!fs.existsSync(config.tls.default.cert)) {
        console.error('TLS certificate not found:', config.tls.default.cert);
        process.exit(1);
    }
}

// Validate plugin files
if (config.plugins) {
    Object.entries(config.plugins).forEach(([name, plugin]) => {
        if (plugin.enabled && plugin.module) {
            try {
                require.resolve(plugin.module);
            } catch (err) {
                console.error(`Plugin ${name} module not found:`, plugin.module);
                process.exit(1);
            }
        }
    });
}

console.log('Configuration validation passed');
```

## Best Practices

1. **Security**:
   - Always use TLS in production
   - Set strong passwords for Redis/MongoDB
   - Limit connection counts per IP
   - Enable rate limiting for API

2. **Performance**:
   - Use multiple processes in production
   - Configure appropriate connection pools
   - Enable compression for high-traffic IMAP
   - Use Redis clustering for scale

3. **Monitoring**:
   - Enable GELF logging for centralized logs
   - Set up health check endpoints
   - Monitor database performance
   - Track authentication failures

4. **Backup**:
   - Regular MongoDB backups
   - Export DKIM keys securely
   - Document configuration changes
   - Test disaster recovery procedures