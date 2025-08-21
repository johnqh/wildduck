# Error Message Enhancements

This document summarizes the improvements made to error messages throughout the WildDuck API to provide more detailed and actionable feedback to users.

## Changes Made

### 1. Enhanced Validation Error Function (`lib/tools.js`)

**Enhancement**: Modified `validationErrors()` function to include actual values that caused validation errors.

**Before**:
```
"username" must be a string
```

**After**:
```
"username" must be a string (received: 12345)
```

**Impact**: All API endpoints that use Joi validation now show the actual invalid values, making debugging much easier.

---

### 2. User Existence Errors (`lib/user-handler.js`)

**Enhancement**: Include the specific username/email that already exists.

**Before**:
```
This username already exists
This email address already exists  
```

**After**:
```
Username "testuser@example.com" already exists
Email address "test@example.com" already exists
```

**Impact**: Users know exactly which identifier is conflicting when creating accounts.

---

### 3. Wildcard Address Validation (`lib/api/addresses.js`)

**Enhancement**: More specific error messages for wildcard address validation failures.

**Before**:
```
Invalid wildcard address
```

**After**:
```
Invalid wildcard address "*user*@example.com": only one wildcard (*) is allowed per address
Invalid wildcard address "verylongusername@example.com": username part too long (max 32 characters)
Invalid wildcard address "invalid*format": does not result in a valid email format
```

**Impact**: Users understand exactly what's wrong with their wildcard address patterns.

---

### 4. Mailbox Operation Errors (`lib/mailbox-handler.js`)

**Enhancement**: Include specific mailbox names and limits in error messages.

**Before**:
```
Mailbox creation failed with code MailboxAlreadyExists
Mailbox creation failed with code ReachedMailboxCountLimit
Mailbox rename failed with code MailboxAlreadyExists
```

**After**:
```
Mailbox "INBOX/Test" already exists
Cannot create mailbox: maximum limit of 100 mailboxes reached
Cannot rename mailbox: target "INBOX/NewName" already exists
```

**Impact**: Users know which specific mailboxes are causing issues and understand their limits.

---

### 5. Message Metadata Validation (`lib/api/messages.js`)

**Enhancement**: More descriptive metadata validation errors.

**Before**:
```
metaData value must be valid JSON object string
```

**After**:
```
Invalid metaData: expected object, received string ("not-an-object")
Invalid metaData: expected object, received object (null)
```

**Impact**: Users understand exactly what type of data was invalid and what was expected.

---

### 6. Lock Acquisition Errors (`lib/api/messages.js`)

**Enhancement**: Include timeout information in lock failure messages.

**Before**:
```
Failed to get folder write lock
```

**After**:
```
Failed to acquire write lock for mailbox operation (timeout: 60000ms)
```

**Impact**: Users understand that the failure was due to a timeout and how long the system waited.

---

### 7. Rate Limiting Error Mapping (`lib/api/error-utils.js`)

**Enhancement**: Added proper HTTP status code mapping for `RateLimitedError`.

**Before**: Rate limiting errors returned generic 500 status codes.

**After**: Rate limiting errors properly return HTTP 429 (Too Many Requests) with detailed messages.

**Impact**: Clients can properly handle rate limiting with correct HTTP status codes.

---

## Benefits

1. **Better Developer Experience**: API consumers get clear, actionable error messages
2. **Easier Debugging**: Actual values are shown in validation errors
3. **Reduced Support Load**: Users can understand and fix issues without contacting support
4. **Standards Compliance**: Proper HTTP status codes for different error types
5. **Consistency**: Uniform error message patterns across all API endpoints

## Testing

All enhancements maintain backward compatibility while improving error message quality. The changes have been tested to ensure they don't break existing functionality while providing significantly better user experience.