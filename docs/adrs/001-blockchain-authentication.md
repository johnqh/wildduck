# ADR-001: Blockchain-Based Authentication System

## Status
Accepted

## Context
Traditional email systems rely on username/password authentication, which has several limitations:
- Password reuse and weak passwords are common security vulnerabilities
- Users must remember and manage multiple passwords
- Password reset mechanisms can be compromised
- No inherent support for Web3 identities

The rise of blockchain-based identity systems (Ethereum, Solana) and naming services (ENS, SNS) provides an opportunity to implement passwordless authentication using cryptographic signatures.

## Decision
We will implement a comprehensive blockchain-based authentication system that supports:

1. **Direct Address Authentication**:
   - EVM addresses (0x...) with ECDSA signatures
   - Solana addresses (Base58) with Ed25519 signatures
   - Base64-encoded EVM addresses for compact representation

2. **Blockchain Name Resolution**:
   - ENS names (.eth, .box domains) resolving to Ethereum addresses
   - SNS names (.sol domains) resolving to Solana addresses

3. **Signature Standards**:
   - Sign-in with Ethereum (SIWE) following EIP-4361
   - Custom Solana message format with tweetnacl verification

4. **Security Features**:
   - Nonce-based replay protection
   - Owner verification for domain names
   - Automatic account creation for valid identifiers

## Implementation Details

### Authentication Flow
1. **Username Validation**: Check if username is a valid blockchain identifier
2. **Address Resolution**: For domain names, resolve to owner address
3. **Signature Verification**: Validate cryptographic signature
4. **Account Management**: Auto-create or authenticate existing account

### Code Organization
- `lib/blockchain-validator.js`: Validates blockchain identifiers
- `lib/name-resolver.js`: Resolves ENS/SNS names to addresses
- `lib/signature-verifier.js`: Verifies cryptographic signatures
- `lib/user-handler.js`: Integrated authentication logic

### Dependencies
- `viem`: Ethereum interaction and SIWE verification
- `@solana/web3.js`: Solana blockchain integration
- `tweetnacl`: Ed25519 signature verification
- `@ensdomains/ensjs`: ENS name resolution
- `bs58`: Base58 encoding/decoding

## Consequences

### Positive
- **Enhanced Security**: Eliminates password-related vulnerabilities
- **Web3 Native**: First-class support for blockchain identities
- **User Experience**: No passwords to remember or manage
- **Future-Proof**: Extensible to new blockchain ecosystems
- **Auto-Discovery**: Email addresses map directly to blockchain identities

### Negative
- **Complexity**: More complex authentication flow
- **Dependencies**: Additional blockchain library dependencies
- **Learning Curve**: Users must understand Web3 concepts
- **Recovery**: No traditional password reset mechanism

### Risks and Mitigations
- **Private Key Loss**: Users must secure their private keys (education/documentation)
- **Signature Replay**: Mitigated by nonce-based replay protection
- **Domain Hijacking**: ENS/SNS ownership verification prevents impersonation
- **Network Dependency**: Graceful fallback for blockchain network issues

## Alternatives Considered

### Traditional Password Authentication
- **Pros**: Well-understood, simple implementation
- **Cons**: Security vulnerabilities, poor UX, not Web3-native
- **Decision**: Deprecated but maintained for migration period

### OAuth/OIDC Integration
- **Pros**: Leverages existing identity providers
- **Cons**: Centralized, not blockchain-native, additional dependencies
- **Decision**: Could be added as supplementary option

### Hardware Security Keys
- **Pros**: Strong security, WebAuthn standard
- **Cons**: Requires physical device, not blockchain-native
- **Decision**: Could complement blockchain authentication

## Migration Strategy

### Phase 1: Implementation
- Implement blockchain authentication alongside existing password auth
- Auto-create accounts for valid blockchain identifiers
- Provide migration tools for existing users

### Phase 2: User Education
- Documentation for Web3 authentication setup
- Client library examples for signature generation
- Integration guides for wallets and dApps

### Phase 3: Gradual Migration
- Encourage blockchain authentication adoption
- Maintain password authentication for backwards compatibility
- Monitor adoption metrics and user feedback

## Monitoring and Success Metrics
- Authentication success rates by method
- User adoption of blockchain authentication
- Security incident reduction
- API usage patterns for Web3 integrations

## Related ADRs
- ADR-002: Multi-Chain Support Strategy
- ADR-003: Account Auto-Creation Policy