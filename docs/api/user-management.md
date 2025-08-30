# User Management API

The User Management API handles authentication, user profiles, account management, and social features for the VTT platform.

## Authentication Endpoints

### Register User
Create a new user account.

```http
POST /auth/register
Content-Type: application/json

{
  "username": "gamemaster123",
  "email": "gm@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "timezone": "America/New_York",
  "acceptedTerms": true
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "gamemaster123",
    "email": "gm@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false
  }
}
```

**Rate Limit**: 3 requests per hour per IP

### Login User
Authenticate with email/username and password.

```http
POST /auth/login
Content-Type: application/json

{
  "identifier": "gm@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "gamemaster123",
    "email": "gm@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true,
    "role": "user",
    "subscription": {
      "tier": "premium",
      "status": "active"
    }
  },
  "session": {
    "id": "sess_abcdef123456",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

Sets `sessionToken` cookie for subsequent requests.

**Rate Limit**: 5 requests per 15 minutes per IP

### Logout User
Invalidate current session.

```http
POST /auth/logout
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true
}
```

### Refresh Token
Extend session with refresh token.

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_xyz789"
}
```

**Response**
```json
{
  "success": true,
  "session": {
    "id": "sess_newtoken456",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

## Password Management

### Request Password Reset
Send password reset email.

```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "gm@example.com"
}
```

**Response**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### Confirm Password Reset
Reset password with token from email.

```http
POST /auth/reset-password/confirm
Content-Type: application/json

{
  "token": "reset_token_abcdef123456",
  "newPassword": "NewSecurePassword456!"
}
```

**Response**
```json
{
  "success": true,
  "message": "Password successfully reset."
}
```

## Email Verification

### Verify Email
Verify email address with token from email.

```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "verify_token_xyz789"
}
```

**Response**
```json
{
  "success": true,
  "message": "Email successfully verified."
}
```

### Resend Verification Email
Send new verification email to authenticated user.

```http
POST /auth/verify-email/resend
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Verification email sent."
}
```

## User Profile

### Get Current User
Get authenticated user's profile.

```http
GET /auth/me
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "gamemaster123",
    "email": "gm@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true,
    "role": "user",
    "subscription": {
      "tier": "premium",
      "status": "active",
      "currentPeriodEnd": "2024-12-31T23:59:59Z"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-12-01T10:30:00Z"
  }
}
```

### Update User Profile
Update user profile information.

```http
PUT /auth/me
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "firstName": "Johnny",
  "lastName": "Smith",
  "timezone": "America/Los_Angeles"
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890",
    "username": "gamemaster123",
    "email": "gm@example.com",
    "firstName": "Johnny",
    "lastName": "Smith",
    "timezone": "America/Los_Angeles"
  }
}
```

### Change Password
Update user password (requires current password).

```http
PUT /auth/me/password
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Response**
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

## User Roles & Permissions

### User Roles
- **user** - Regular user with basic permissions
- **moderator** - Can moderate content and users
- **admin** - Full administrative access
- **super_admin** - Complete system access

### Permission Checks
Most endpoints automatically check permissions based on user role. Premium features require active subscription.

## Error Responses

### Validation Errors
```json
{
  "error": "validation_failed",
  "details": [
    {
      "field": "email",
      "code": "invalid_email",
      "message": "Please provide a valid email address"
    },
    {
      "field": "password",
      "code": "password_too_weak",
      "message": "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
    }
  ]
}
```

### Authentication Errors
```json
{
  "error": "invalid_credentials",
  "message": "Email or password is incorrect"
}
```

```json
{
  "error": "email_not_verified",
  "message": "Please verify your email address before continuing",
  "code": "EMAIL_VERIFICATION_REQUIRED"
}
```

### Rate Limit Errors
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many authentication attempts, please try again later.",
  "retryAfter": 900
}
```

## Security Features

### Password Requirements
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter  
- Must contain number
- Must contain special character

### Session Security
- JWT tokens with configurable expiration
- Refresh token rotation
- IP address tracking
- Device fingerprinting
- Automatic session cleanup

### Rate Limiting
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP
- Password reset: 3 per hour per email
- Email verification: 5 per hour per user

### Security Headers
All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## SDK Examples

### JavaScript/Node.js
```javascript
const { VTTClient } = require('@vtt-platform/js-sdk');

const client = new VTTClient({
  baseURL: 'https://api.vtt-platform.com/v1'
});

// Register new user
try {
  const user = await client.auth.register({
    username: 'gamemaster123',
    email: 'gm@example.com',
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe',
    acceptedTerms: true
  });
  console.log('User created:', user.id);
} catch (error) {
  console.error('Registration failed:', error.message);
}

// Login
try {
  const session = await client.auth.login('gm@example.com', 'SecurePassword123!');
  console.log('Logged in:', session.user.username);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Update profile
try {
  const updatedUser = await client.auth.updateProfile({
    firstName: 'Johnny'
  });
  console.log('Profile updated:', updatedUser.firstName);
} catch (error) {
  console.error('Update failed:', error.message);
}
```

### React Hook
```jsx
import { useAuth } from '@vtt-platform/react-components';

function LoginForm() {
  const { login, user, loading, error } = useAuth();
  
  const handleSubmit = async (email, password) => {
    await login(email, password);
  };
  
  if (user) {
    return <div>Welcome, {user.firstName}!</div>;
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
}
```

## Testing

### Test Accounts
Development environment includes test accounts:
- **Email**: `test@example.com`, **Password**: `TestPassword123!`
- **Email**: `admin@example.com`, **Password**: `AdminPassword123!`

### Mock Endpoints
Staging environment supports mock responses:
- Add `X-Mock-Response: true` header for predictable responses
- Use `X-Mock-Delay: 1000` to simulate network latency

---

For more information, see the [Main API Documentation](./README.md).
