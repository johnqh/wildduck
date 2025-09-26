# WildDuck API Documentation

WildDuck provides a comprehensive REST API for managing email accounts, mailboxes, messages, and server configuration. The API supports both standard authentication and crypto emails mode.

## Authentication Modes

### Standard Authentication Mode
- Traditional username/password authentication
- Requires existing user accounts
- Password validation enforced

### Crypto Emails Mode
- Auto-creates user accounts if they don't exist
- No password validation required
- Requires `emailDomain` parameter
- Enabled via `APPCONF_api_cryptoEmails=true`

---

## Authentication & Security

### `POST /preauth`
**Pre-authentication check**
- Check if username exists for pre-authentication
- Validates username availability
- Returns 2FA requirements

### `POST /authenticate`
**User authentication** ⚡ **Modified for Crypto Emails**
- **Standard Mode**: Requires username + password
- **Crypto Mode**: Requires username + emailDomain, auto-creates users
- Generates access tokens
- Returns user details and authentication status

### `DELETE /authenticate`
**Invalidate access token**
- Revokes current access token
- Logs out user session
- Security cleanup

### `GET /users/:user/authlog`
**List authentication events**
- View user authentication history
- Filter by action, IP address, date
- Security audit trail

### `GET /users/:user/authlog/:event`
**Get specific authentication event**
- Detailed authentication event information
- Forensic analysis capabilities

---

## Two-Factor Authentication (2FA)

### TOTP (Time-based One-Time Password)
- `POST /users/:user/2fa/totp/setup` - Setup TOTP 2FA
- `POST /users/:user/2fa/totp/enable` - Enable TOTP 2FA
- `DELETE /users/:user/2fa/totp` - Disable TOTP 2FA
- `POST /users/:user/2fa/totp/check` - Verify TOTP token

### WebAuthn (Hardware Keys)
- `GET /users/:user/2fa/webauthn/credentials` - List WebAuthn credentials
- `DELETE /users/:user/2fa/webauthn/credentials/:credential` - Delete credential
- `POST /users/:user/2fa/webauthn/registration-challenge` - Start registration
- `POST /users/:user/2fa/webauthn/registration-attestation` - Complete registration
- `POST /users/:user/2fa/webauthn/authentication-challenge` - Start authentication
- `POST /users/:user/2fa/webauthn/authentication-assertion` - Complete authentication

### Custom 2FA
- `PUT /users/:user/2fa/custom` - Setup custom 2FA method
- `DELETE /users/:user/2fa/custom` - Disable custom 2FA
- `DELETE /users/:user/2fa` - Disable all 2FA methods

---

## User Management

### `GET /users`
**List users**
- Query and filter users
- Pagination support
- Search by username, email, or other criteria

### `POST /users`
**Create new user**
- Create email accounts
- Set quotas and permissions
- Configure mailbox settings

### `GET /users/resolve/:username`
**Resolve username to user ID**
- Username to ID mapping
- User lookup functionality

### `GET /users/:user`
**Get user information**
- Retrieve user profile
- Account settings and status
- Storage usage statistics

### `PUT /users/:user`
**Update user settings**
- Modify user configuration
- Update quotas, passwords, settings
- Account management

### `DELETE /users/:user`
**Delete user account**
- Remove user and all data
- Cleanup mailboxes and messages
- Account termination

### `GET /users/:user/restore`
**Get deleted user information**
- View deleted account details
- Recovery information

### `POST /users/:user/restore`
**Restore deleted user**
- Recover deleted accounts
- Data restoration

---

## User Session Management

### `PUT /users/:user/logout`
**Force logout user sessions**
- Terminate active sessions
- Security enforcement

### `POST /users/:user/quota/reset`
**Reset user quota usage**
- Recalculate storage usage
- Quota management

### `POST /quota/reset`
**Reset quota for multiple users**
- Bulk quota recalculation
- System maintenance

### `POST /users/:user/password/reset`
**Reset user password**
- Password recovery
- Security operations

---

## Email Addresses

### User Address Management
- `GET /users/:user/addresses` - List user email addresses
- `POST /users/:user/addresses` - Add new email address to user
- `GET /users/:user/addresses/:address` - Get address details
- `PUT /users/:user/addresses/:id` - Update address settings
- `DELETE /users/:user/addresses/:address` - Remove email address
- `GET /users/:user/addressregister` - Get address registration info

### Global Address Management
- `GET /addresses` - List all email addresses system-wide
- `GET /addresses/resolve/:address` - Resolve address to user
- `PUT /addresses/renameDomain` - Rename domain across all addresses

### Forwarded Addresses
- `GET /addresses/forwarded` - List forwarded addresses
- `POST /addresses/forwarded` - Create forwarded address
- `PUT /addresses/forwarded/:id` - Update forwarded address
- `DELETE /addresses/forwarded/:address` - Delete forwarded address
- `GET /addresses/forwarded/:address` - Get forwarded address info

---

## Mailboxes

### `GET /users/:user/mailboxes`
**List user mailboxes**
- INBOX, Sent, Drafts, Trash, etc.
- Mailbox statistics and metadata

### `POST /users/:user/mailboxes`
**Create new mailbox**
- Custom folder creation
- Mailbox configuration

### `GET /users/:user/mailboxes/:mailbox`
**Get mailbox information**
- Mailbox details and statistics
- Message counts and sizes

### `PUT /users/:user/mailboxes/:mailbox`
**Update mailbox settings**
- Rename mailboxes
- Modify mailbox properties

### `DELETE /users/:user/mailboxes/:mailbox`
**Delete mailbox**
- Remove mailbox and contents
- Folder management

---

## Messages

### Message Management
- `GET /users/:user/mailboxes/:mailbox/messages` - List messages in mailbox
- `POST /users/:user/mailboxes/:mailbox/messages` - Upload message to mailbox
- `GET /users/:user/mailboxes/:mailbox/messages/:message` - Get message details
- `PUT /users/:user/mailboxes/:mailbox/messages/:message` - Update message flags
- `DELETE /users/:user/mailboxes/:mailbox/messages/:message` - Delete message
- `GET /users/:user/mailboxes/:mailbox/messages/:message/message.eml` - Download raw message
- `GET /users/:user/mailboxes/:mailbox/messages/:message/attachments/:attachment` - Download attachment

### Bulk Operations
- `PUT /users/:user/mailboxes/:mailbox/messages` - Bulk update message flags
- `DELETE /users/:user/mailboxes/:mailbox/messages` - Bulk delete messages

### Message Search
- `GET /users/:user/search` - Search messages across mailboxes
- `POST /users/:user/search` - Advanced message search with filters

### Message Actions
- `POST /users/:user/mailboxes/:mailbox/messages/:message/forward` - Forward message
- `POST /users/:user/mailboxes/:mailbox/messages/:message/submit` - Submit message for delivery

### Outbound Messages
- `DELETE /users/:user/outbound/:queueId` - Cancel outbound message

### Archive Management
- `GET /users/:user/archived/messages` - List archived messages
- `POST /users/:user/archived/restore` - Bulk restore archived messages
- `POST /users/:user/archived/messages/:message/restore` - Restore specific archived message

---

## Message Submission

### `POST /users/:user/submit`
**Submit email for delivery**
- Send emails via API
- SMTP message submission
- Delivery queue management

---

## Filters & Rules

### `GET /filters`
**List available filter types**
- Filter capabilities and syntax
- Available filter conditions

### `GET /users/:user/filters`
**List user filters**
- Message filtering rules
- Auto-processing configuration

### `POST /users/:user/filters`
**Create message filter**
- Set up automatic message processing
- Conditional actions and routing

### `GET /users/:user/filters/:filter`
**Get filter details**
- Filter rule configuration
- Condition and action details

### `PUT /users/:user/filters/:filter`
**Update filter**
- Modify filter rules
- Update conditions and actions

### `DELETE /users/:user/filters/:filter`
**Delete filter**
- Remove automatic processing rules

---

## Auto-Reply

### `PUT /users/:user/autoreply`
**Setup auto-reply**
- Out-of-office messages
- Vacation responder configuration

### `GET /users/:user/autoreply`
**Get auto-reply settings**
- Current auto-reply configuration
- Status and message content

### `DELETE /users/:user/autoreply`
**Disable auto-reply**
- Turn off automatic responses

---

## Application-Specific Passwords (ASPs)

### `GET /users/:user/asps`
**List application passwords**
- App-specific authentication tokens
- Third-party client access

### `POST /users/:user/asps`
**Create application password**
- Generate tokens for mail clients
- Secure app authentication

### `GET /users/:user/asps/:asp`
**Get ASP details**
- Application password information

### `DELETE /users/:user/asps/:asp`
**Delete application password**
- Revoke app access tokens

---

## File Storage

### `POST /users/:user/storage`
**Upload file**
- Attachment storage
- File management system

### `GET /users/:user/storage`
**List stored files**
- User file inventory
- Storage usage details

### `GET /users/:user/storage/:file`
**Download file**
- File retrieval
- Attachment downloads

### `DELETE /users/:user/storage/:file`
**Delete file**
- Remove stored files
- Storage cleanup

---

## DKIM Management

### `GET /dkim`
**List DKIM keys**
- Domain signing keys
- Email authentication setup

### `POST /dkim`
**Create DKIM key**
- Generate domain signing keys
- Email security configuration

### `GET /dkim/resolve/:domain`
**Get DKIM key for domain**
- Domain-specific key lookup

### `GET /dkim/:dkim`
**Get DKIM key details**
- Key information and status

### `DELETE /dkim/:dkim`
**Delete DKIM key**
- Remove domain signing keys

---

## Certificate Management

### `GET /certs`
**List TLS certificates**
- SSL/TLS certificate inventory
- Security certificate management

### `POST /certs`
**Upload TLS certificate**
- Install security certificates
- HTTPS/IMAPS/POP3S configuration

### `GET /certs/resolve/:servername`
**Get certificate for server**
- Server-specific certificate lookup

### `GET /certs/:cert`
**Get certificate details**
- Certificate information and expiration

### `DELETE /certs/:cert`
**Delete certificate**
- Remove SSL/TLS certificates

---

## Domain Management

### Domain Aliases
- `GET /domainaliases` - List domain aliases
- `POST /domainaliases` - Create domain alias
- `GET /domainaliases/resolve/:alias` - Resolve domain alias
- `GET /domainaliases/:alias` - Get alias details
- `DELETE /domainaliases/:alias` - Delete domain alias

### Domain Access Control
- `POST /domainaccess/:tag/allow` - Allow domain access
- `POST /domainaccess/:tag/block` - Block domain access
- `GET /domainaccess/:tag/allow` - List allowed domains
- `GET /domainaccess/:tag/block` - List blocked domains
- `DELETE /domainaccess/:domain` - Remove domain access rule

---

## System Management

### Settings
- `GET /settings` - List system settings
- `POST /settings/:key` - Create/update setting
- `GET /settings/:key` - Get specific setting

### Health & Monitoring
- `GET /health` - System health check
- `GET /users/:user/updates` - Get user update notifications

### Data Operations
- `POST /data/export` - Export user data
- `POST /data/import` - Import user data

### Webhooks
- `GET /webhooks` - List configured webhooks
- `POST /webhooks` - Create webhook
- `DELETE /webhooks/:webhook` - Delete webhook

### Audit
- `POST /audit` - Create audit entry
- `GET /audit/:audit` - Get audit details
- `GET /audit/:audit/export.mbox` - Export audit as mbox

---

## ACME/Let's Encrypt

### `GET /.well-known/acme-challenge/:token`
**ACME challenge response**
- SSL certificate validation
- Let's Encrypt integration

---

## API Configuration

### Base URL
```
http://localhost:8080
```

### Authentication
- Access tokens via `/authenticate`
- API key authentication
- Role-based permissions

### Rate Limiting
- Per-user request limits
- API throttling controls

### Response Format
All responses return JSON with standard structure:
```json
{
  "success": true|false,
  "error": "Error message (if applicable)",
  "code": "ErrorCode",
  "data": { /* Response data */ }
}
```

### Error Codes
- `AuthFailed` - Authentication failure
- `InputValidationError` - Invalid input parameters
- `InternalDatabaseError` - Database operation failed
- `UserNotFound` - User does not exist
- `PermissionDenied` - Insufficient permissions

---

## Environment Variables

### Crypto Emails Mode
```bash
# Enable crypto emails mode (auto-create users)
APPCONF_api_cryptoEmails=true

# Standard authentication mode
APPCONF_api_cryptoEmails=false
```

### API Configuration
```bash
# API server port
APPCONF_api_port=8080

# API server host
APPCONF_api_host=127.0.0.1

# Enable HTTPS
APPCONF_api_secure=true
```

---

## Usage Examples

### Standard Authentication
```bash
curl -X POST http://localhost:8080/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "secretpassword"
  }'
```

### Crypto Emails Mode
```bash
curl -X POST http://localhost:8080/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "cryptouser",
    "emailDomain": "blockchain.com"
  }'
```

### Create User
```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "password123",
    "address": "newuser@example.com",
    "name": "New User"
  }'
```

### List Messages
```bash
curl -X GET "http://localhost:8080/users/USER_ID/mailboxes/MAILBOX_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

This comprehensive API enables full email server management, user administration, and message handling with support for both traditional and blockchain/crypto-oriented authentication workflows.