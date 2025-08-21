# WildDuck Authentication System

## Overview

WildDuck implements a unified blockchain-based authentication system across all protocols (API, IMAP, POP3, SMTP/LMTP). The system eliminates traditional passwords in favor of cryptographic signatures, providing enhanced security and seamless Web3 integration.

## Supported Identity Types

### Direct Blockchain Addresses
- **EVM Addresses**: Standard Ethereum-compatible addresses (0x...)
- **Solana Addresses**: Base58-encoded Solana public keys

### Blockchain Name Services
- **ENS Names**: Ethereum Name Service (.eth, .box domains)
- **SNS Names**: Solana Name Service (.sol domains)

## Signature Requirements

### EVM Signatures (Ethereum)
- **For EVM addresses**: Base64-encoded Sign-In with Ethereum (SIWE) signature
- **For ENS names**: Base64-encoded SIWE signature from the wallet that owns the ENS name
- **Message format**: Standard SIWE format with nonce

### Solana Signatures
- **For Solana addresses**: Sign-In with Solana signature without additional encoding
- **For SNS names**: Sign-In with Solana signature from the wallet that owns the SNS name
- **Message format**: Standard Solana sign-in format with nonce

## Authentication Flow

### 1. Pre-Authentication (API Only)
The `/preauth` endpoint allows clients to verify if a username exists and is valid for authentication:

```javascript
POST /preauth
{
  "username": "vitalik.eth",
  "scope": "master"
}
```

Response includes user ID, username, and default email address if the user exists.

### 2. Main Authentication Process

#### Step 1: Identity Resolution
- System validates the username format using `blockchain-validator.js`
- For ENS/SNS names, resolves to the owner address via `name-resolver.js`
- Determines the blockchain type (EVM or Solana)

#### Step 2: Signature Verification
- Client provides a signature and nonce
- System constructs message: `Sign in to WildDuck\nNonce: [nonce]`
- Verifies signature using `signature-verifier.js`:
  - **EVM**: Decodes base64 signature to hex, uses viem library for verification
  - **Solana**: Uses signature as-is for Ed25519 verification with tweetnacl
- Nonce prevents replay attacks

#### Step 3: User Lookup/Creation
- System checks if user exists in MongoDB
- If user doesn't exist AND signature is valid:
  - Auto-creates new user account with blockchain authentication
  - Sets up initial mailboxes and configuration
- If user exists, verifies account status (not disabled/suspended)

#### Step 4: Session Establishment
- Updates last authentication timestamp
- Stores nonce to prevent reuse
- Returns authentication response with user details
- Optionally generates access token for API use

## Protocol-Specific Implementation

### API Authentication (`/authenticate`)

```javascript
POST /authenticate
{
  "username": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",  // or ENS/SNS name
  "signature": "base64_encoded_signature",  // Base64 for EVM, raw for Solana
  "nonce": "unique_nonce_123",
  "scope": "master",
  "token": true,  // Optional: generate access token
  "signerAddress": "0x..."  // Optional: Required for ENS/SNS names
}
```

**Signature Format by Username Type:**
- **EVM address**: Base64-encoded SIWE signature
- **ENS name**: Base64-encoded SIWE signature (signerAddress required)
- **Solana address**: Raw Sign-In with Solana signature
- **SNS name**: Raw Sign-In with Solana signature (signerAddress required)

**Features:**
- Full error details with timestamps
- Multiple scope support (master, imap, smtp, pop3)
- Optional token generation for stateless authentication
- Rate limiting per IP and user
- Detailed error codes and messages

### IMAP Authentication

Located in `lib/handlers/on-auth.js`:

**Authentication Format:**
- **Username**: Blockchain address or ENS/SNS name
- **Password**: The signature (same as API signature field)
  - Base64-encoded for EVM/ENS
  - Raw for Solana/SNS

```javascript
// IMAP client configuration example
const client = new ImapClient({
  host: 'mail.example.com',
  port: 993,
  secure: true,
  auth: {
    user: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',  // or ENS/SNS
    pass: 'base64_encoded_signature'  // Pass signature as password
  }
});
```

**Features:**
- Connection limit enforcement per user
- Session tracking for concurrent connections
- Automatic nonce generation if not provided
- Support for IDLE and other IMAP extensions

### POP3 Authentication

Located in `pop3.js`:

**Authentication Format:**
- **Username**: Blockchain address or ENS/SNS name
- **Password**: The signature (same as API signature field)
  - Base64-encoded for EVM/ENS
  - Raw for Solana/SNS

```javascript
// POP3 client configuration
const pop3Client = {
  host: 'mail.example.com',
  port: 995,
  secure: true,
  username: 'vitalik.eth',  // or address
  password: 'base64_encoded_signature'  // Signature as password
};
```

**Features:**
- Simplified authentication for basic mail retrieval
- Message limit enforcement (MAX_MESSAGES = 250)
- Session-based message tracking
- Automatic nonce generation

### SMTP/LMTP Authentication

**LMTP** (Local Mail Transfer Protocol):
- Located in `lmtp.js`
- Authentication is DISABLED (`disabledCommands: ['AUTH']`)
- Validates recipients during RCPT TO command
- Used for internal mail delivery from MTA

**SMTP** (For sending):
- Implemented in external MTA (Haraka, ZoneMTA)
- Uses same authentication pattern as IMAP/POP3
- Username: Blockchain address or ENS/SNS name
- Password: Signature (base64 for EVM, raw for Solana)

## Security Features

### Nonce Management
- Each authentication requires a unique nonce
- Nonces are stored with user record to prevent replay
- Automatic rejection of reused nonces
- Protocol servers auto-generate nonces if not provided

### Signature Encoding
- **EVM/ENS**: Base64-encoded signatures for all protocols
- **Solana/SNS**: Raw signatures without encoding
- Automatic detection and conversion in `signature-verifier.js`

### Rate Limiting
- Per-IP rate limiting for failed attempts
- Per-user rate limiting to prevent brute force
- Automatic release after successful authentication

### Account Status Checks
- Disabled accounts cannot authenticate
- Suspended accounts are temporarily blocked
- Scope-specific disabling (e.g., disable SMTP but allow IMAP)

### Audit Logging
- All authentication attempts are logged to `authlog` collection
- Includes timestamp, IP, protocol, result, and error details
- Configurable retention period

## Error Handling

Enhanced error responses include:
- **Error Code**: Specific error identifier
- **Message**: Human-readable error description
- **Details**: Actionable information for resolution
- **Timestamp**: ISO 8601 formatted timestamp

Common error codes:
- `InvalidBlockchainIdentifier`: Invalid address format
- `BlockchainAddressNotFound`: ENS/SNS name not found
- `AuthFailed`: Signature verification failed
- `NonceReused`: Nonce already used
- `UserDisabled`: Account is disabled
- `RateLimited`: Too many attempts

## Database Schema

### User Document Structure
```javascript
{
  _id: ObjectId,
  username: "vitalik.eth",
  unameview: "vitalik.eth",  // Normalized username
  address: "vitalik.eth@localhost",
  
  blockchainAuth: {
    type: "evm",  // or "solana"
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    lastNonce: "unique_nonce_123",
    lastAuth: ISODate("2024-01-01T00:00:00Z")
  },
  
  disabled: false,
  suspended: false,
  disabledScopes: [],  // e.g., ["smtp"]
  
  // Standard WildDuck user fields...
}
```

### Authentication Log Structure
```javascript
{
  _id: ObjectId,
  user: ObjectId,  // Reference to user
  action: "authentication",
  result: "success",  // or "fail"
  source: "api",  // or "blockchain"
  protocol: "IMAP",
  ip: "192.168.1.1",
  sess: "session-id",
  username: "vitalik.eth",
  created: ISODate(),
  last: ISODate(),
  events: 1,  // Increment for repeated events
  expires: ISODate()  // Auto-cleanup
}
```

## Configuration

### API Configuration (`config/api.toml`)
```toml
[api]
port = 8080
host = "127.0.0.1"
secure = false

[api.accessControl]
enabled = false
secret = "shared-secret"
```

### IMAP Configuration (`config/imap.toml`)
```toml
[imap]
port = 9993
host = "0.0.0.0"
secure = true
maxConnections = 15
```

### POP3 Configuration (`config/pop3.toml`)
```toml
[pop3]
port = 9995
host = "0.0.0.0"
secure = true
maxMessages = 250
```

### LMTP Configuration (`config/lmtp.toml`)
```toml
[lmtp]
port = 2424
host = "127.0.0.1"
disableSTARTTLS = true
```

## Auto-User Creation

When a new blockchain identity authenticates:

1. **Validation**: Ensures valid blockchain identifier
2. **Signature Verification**: Confirms ownership
3. **User Creation**: Creates account with:
   - Username: blockchain identifier
   - Email: `identifier@domain`
   - Default mailboxes (INBOX, Sent, Trash, etc.)
   - Blockchain auth configuration
4. **First Login**: Immediate access after creation

## Integration Examples

### JavaScript/TypeScript Client (EVM)
```typescript
import { createWalletClient } from 'viem';
import { mainnet } from 'viem/chains';

async function authenticateEVM() {
  const wallet = createWalletClient({
    chain: mainnet,
    transport: http()
  });
  
  const nonce = generateNonce();
  const message = `Sign in to WildDuck\nNonce: ${nonce}`;
  const signature = await wallet.signMessage({ message });
  
  // Convert signature to base64 for EVM
  const base64Signature = Buffer.from(signature.slice(2), 'hex').toString('base64');
  
  const response = await fetch('https://mail.example.com/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: address,
      signature: base64Signature,
      nonce: nonce,
      scope: 'master',
      token: true
    })
  });
  
  const { token } = await response.json();
  return token;
}
```

### Solana Client Example
```javascript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

async function authenticateSolana(keypair) {
  const nonce = generateNonce();
  const message = `Sign in to WildDuck\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  
  // Sign with Solana wallet
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);
  
  const response = await fetch('https://mail.example.com/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: keypair.publicKey.toString(),
      signature: signatureBase58,  // No base64 encoding for Solana
      nonce: nonce,
      scope: 'master',
      token: true
    })
  });
  
  return response.json();
}
```

### IMAP Client Configuration
```javascript
// For EVM/ENS
const evmImapClient = {
  host: 'mail.example.com',
  port: 993,
  secure: true,
  auth: {
    user: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
    pass: base64EncodedSignature  // Base64 encoded
  }
};

// For Solana/SNS
const solanaImapClient = {
  host: 'mail.example.com',
  port: 993,
  secure: true,
  auth: {
    user: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    pass: solanaSignatureBase58  // Raw base58, not base64
  }
};
```

## Migration from Password Authentication

For existing WildDuck installations:

1. **Hybrid Mode**: Support both password and blockchain auth during transition
2. **User Migration**: Update user documents with blockchain auth details
3. **Client Updates**: Modify clients to use signature authentication
4. **Deprecation**: Phase out password support after migration

## Troubleshooting

### Common Issues

**"Invalid blockchain identifier"**
- Verify address format (0x prefix for EVM, correct length)
- Check ENS/SNS name is properly formatted

**"Signature verification failed"**
- EVM: Ensure signature is base64 encoded
- Solana: Ensure signature is NOT base64 encoded
- Verify message format matches exactly
- Check signature is from correct address

**"Nonce already used"**
- Generate a new nonce for each authentication
- Ensure client isn't reusing old signatures

**"User disabled"**
- Account has been administratively disabled
- Contact system administrator

**"Rate limited"**
- Too many failed attempts
- Wait before retrying
- Check IP isn't blacklisted

### Debug Logging

Enable verbose logging:
```toml
[log]
level = "silly"
```

Monitor authentication attempts:
```bash
tail -f /var/log/wildduck.log | grep AUTH
```

Check MongoDB auth logs:
```javascript
db.authlog.find({ user: ObjectId("...") }).sort({ created: -1 })
```

## Performance Considerations

- Blockchain signature verification is CPU-intensive
- ENS/SNS resolution requires external API calls
- Consider caching resolved addresses
- Rate limiting prevents abuse
- Connection pooling for protocol servers

## Security Best Practices

1. **Always use HTTPS/TLS** for API endpoints
2. **Implement rate limiting** at network level
3. **Monitor authentication logs** for anomalies
4. **Regular security audits** of blockchain integration
5. **Keep dependencies updated** (viem, tweetnacl, etc.)
6. **Validate all input** before blockchain operations
7. **Use secure nonce generation** (cryptographically random)
8. **Implement session timeouts** for idle connections
9. **Regular backup** of user data and auth logs
10. **Test disaster recovery** procedures

## Future Enhancements

- Support for additional blockchain networks
- Multi-signature authentication
- Hardware wallet integration
- OAuth2/OIDC bridge for legacy clients
- Zero-knowledge proof authentication
- Decentralized identity (DID) support
- Smart contract-based access control
- Biometric authentication binding
- WebAuthn integration for additional security