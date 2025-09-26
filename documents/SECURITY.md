The Correct Architecture

For Browser/Mobile Apps:

// 1. User authenticates with credentials
POST /authenticate
{
"username": "user@example.com",
"password": "userpassword"
}

// 2. Receives a user-specific JWT token
{
"success": true,
"token": "eyJhbGciOiJIUzI1...", // JWT with role: "user"
"userId": "507f1f77bcf86cd799439011"
}

// 3. Use the JWT for subsequent calls
GET /users/me
Authorization: Bearer eyJhbGciOiJIUzI1...
// This token has limited permissions, not root!

The Proper Setup:

# config/api.toml

# DO NOT SET accessToken for public APIs!

# accessToken = "..." # COMMENTED OUT

[accessControl]
enabled = true # Use JWT tokens instead

Security Recommendations

1. NEVER use accessToken with client-side apps
2. Use JWT tokens with proper role-based permissions
3. Implement proper authentication flow:


    - Users login with credentials
    - Receive user-specific tokens
    - Tokens have limited permissions (not root!)

4. For admin access: Create separate admin accounts with admin JWTs
