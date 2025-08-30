# Notifications API

The Notifications API manages email, push, and in-app notifications with user preferences, templates, and delivery tracking.

## Notification Preferences

### Get User Preferences
Retrieve user's notification preferences.

```http
GET /notifications/preferences
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "preferences": {
    "email": {
      "enabled": true,
      "account": true,
      "game": true,
      "billing": true,
      "system": true,
      "marketing": false
    },
    "push": {
      "enabled": true,
      "account": true,
      "game": true,
      "billing": true,
      "system": true
    },
    "inApp": {
      "enabled": true,
      "account": true,
      "game": true,
      "billing": true,
      "system": true
    }
  }
}
```

### Update Preferences
Update notification preferences.

```http
PUT /notifications/preferences
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "email": {
    "enabled": true,
    "marketing": false,
    "game": true
  },
  "push": {
    "enabled": false
  }
}
```

**Response**
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

## In-App Notifications

### Get In-App Notifications
Retrieve user's in-app notifications.

```http
GET /notifications/in-app?includeRead=false&limit=50
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notif_1234567890",
      "type": "success",
      "title": "Campaign Published",
      "message": "Your campaign 'Lost Mine of Phandelver' has been published successfully.",
      "actionUrl": "/campaigns/camp_abc123",
      "actionText": "View Campaign",
      "read": false,
      "createdAt": "2024-12-01T10:30:00Z"
    },
    {
      "id": "notif_0987654321", 
      "type": "info",
      "title": "New Player Joined",
      "message": "Alice has joined your campaign 'Curse of Strahd'.",
      "actionUrl": "/campaigns/camp_def456/players",
      "actionText": "View Players",
      "read": false,
      "createdAt": "2024-12-01T09:15:00Z"
    }
  ]
}
```

### Get Unread Count
Get count of unread in-app notifications.

```http
GET /notifications/in-app/unread-count
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "count": 3
}
```

### Mark as Read (Single)
Mark a specific notification as read.

```http
POST /notifications/in-app/notif_1234567890/read
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### Mark as Read (Bulk)
Mark multiple notifications as read.

```http
POST /notifications/in-app/mark-read
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "notificationIds": [
    "notif_1234567890",
    "notif_0987654321",
    "notif_5678901234"
  ]
}
```

**Response**
```json
{
  "success": true,
  "message": "Marked 3 notifications as read"
}
```

### Delete Notification
Delete a specific in-app notification.

```http
DELETE /notifications/in-app/notif_1234567890
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

### Clear All Notifications
Clear all or only read notifications.

```http
POST /notifications/in-app/clear-all?onlyRead=false
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "All notifications cleared"
}
```

## Game Invitations

### Send Game Invites
Send email invitations to join a game.

```http
POST /notifications/invites/send
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "emails": [
    "player1@example.com",
    "player2@example.com"
  ],
  "gameId": "game_abc123",
  "message": "Join us for an epic D&D adventure!"
}
```

**Response**
```json
{
  "success": true,
  "results": [
    {
      "email": "player1@example.com",
      "success": true
    },
    {
      "email": "player2@example.com", 
      "success": true
    }
  ],
  "sent": 2,
  "failed": 0
}
```

## Email Management

### Send Test Email
Send a test email to verify email settings.

```http
POST /notifications/email/test
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Test email sent"
}
```

### Unsubscribe from Emails
Unsubscribe from email notifications (public endpoint).

```http
GET /notifications/email/unsubscribe?userId=user_123&category=marketing
```

**Response**
```json
{
  "success": true,
  "message": "Successfully unsubscribed"
}
```

### Resubscribe to Emails
Resubscribe to email notifications.

```http
POST /notifications/email/resubscribe
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "category": "game"
}
```

**Response**
```json
{
  "success": true,
  "message": "Successfully resubscribed"
}
```

## Push Notifications

### Register Push Device
Register device for push notifications.

```http
POST /notifications/push/register-device
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "deviceToken": "firebase_device_token_here",
  "deviceType": "android"
}
```

**Response**
```json
{
  "success": true,
  "message": "Device registered for push notifications"
}
```

### Unregister Push Device
Remove device from push notifications.

```http
DELETE /notifications/push/device/device_123
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Device unregistered from push notifications"
}
```

### Send Test Push
Send test push notification.

```http
POST /notifications/push/test
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "message": "Test push notification sent"
}
```

## Notification History

### Get Notification History
Retrieve notification delivery history.

```http
GET /notifications/history?limit=50&offset=0&type=email
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "history": [
    {
      "id": "hist_1234567890",
      "type": "email",
      "templateId": "welcome",
      "recipient": "user@example.com",
      "subject": "Welcome to VTT Platform!",
      "status": "delivered",
      "sentAt": "2024-12-01T10:00:00Z",
      "deliveredAt": "2024-12-01T10:00:15Z",
      "openedAt": "2024-12-01T10:30:00Z",
      "clickedAt": "2024-12-01T10:32:00Z"
    }
  ]
}
```

### Get Notification Analytics
Get notification performance analytics.

```http
GET /notifications/analytics?startDate=2024-11-01&endDate=2024-12-01
Authorization: Bearer <session_token>
```

**Response**
```json
{
  "success": true,
  "analytics": {
    "period": {
      "start": "2024-11-01T00:00:00Z",
      "end": "2024-12-01T00:00:00Z"
    },
    "email": {
      "sent": 156,
      "delivered": 152,
      "opened": 89,
      "clicked": 34,
      "bounced": 2,
      "deliveryRate": 0.974,
      "openRate": 0.586,
      "clickRate": 0.218
    },
    "push": {
      "sent": 45,
      "delivered": 43,
      "opened": 28,
      "deliveryRate": 0.956,
      "openRate": 0.622
    },
    "inApp": {
      "created": 78,
      "viewed": 65,
      "clicked": 23,
      "viewRate": 0.833,
      "clickRate": 0.295
    }
  }
}
```

## Notification Types

### Email Categories
- **account** - Registration, verification, password resets
- **game** - Game invitations, session updates, player actions
- **billing** - Payment confirmations, invoice notifications, subscription changes
- **system** - Maintenance notifications, security alerts, service updates
- **marketing** - Product updates, feature announcements, promotions

### In-App Notification Types
- **success** - Green notification for successful actions
- **info** - Blue notification for informational messages
- **warning** - Yellow notification for warnings or cautions
- **error** - Red notification for errors or failures

### Push Notification Platforms
- **Android** - Firebase Cloud Messaging (FCM)
- **iOS** - Apple Push Notification service (APNs)
- **Web** - Web Push Protocol with VAPID

## Error Responses

### Notification Errors
```json
{
  "error": "notifications_disabled",
  "message": "User has disabled this type of notification"
}
```

```json
{
  "error": "invalid_device_token",
  "message": "The provided device token is invalid or expired"
}
```

```json
{
  "error": "template_not_found",
  "message": "The specified notification template does not exist"
}
```

### Delivery Errors
```json
{
  "error": "email_delivery_failed",
  "message": "Email could not be delivered",
  "details": {
    "bounceType": "permanent",
    "bounceReason": "mailbox_full"
  }
}
```

```json
{
  "error": "push_delivery_failed",
  "message": "Push notification delivery failed",
  "details": {
    "error": "device_token_invalid"
  }
}
```

## Notification Templates

### Available Templates

#### Email Templates
- `welcome` - Welcome new users
- `password-reset` - Password reset instructions
- `email-verification` - Email address verification
- `game-invite` - Game invitation
- `payment-failed` - Failed payment notification
- `subscription-created` - New subscription confirmation
- `subscription-canceled` - Subscription cancellation confirmation

#### Push Templates
- `game-started` - Game session started
- `player-joined` - New player joined game
- `turn-notification` - Your turn in game
- `message-received` - New message in game chat

#### In-App Templates
- `campaign-published` - Campaign successfully published
- `asset-uploaded` - Asset upload completed
- `storage-warning` - Approaching storage limit
- `feature-announcement` - New feature available

## SDK Examples

### JavaScript Client
```javascript
const { VTTClient } = require('@vtt-platform/js-sdk');

const client = new VTTClient({
  sessionToken: 'your-session-token'
});

// Get notification preferences
const preferences = await client.notifications.getPreferences();
console.log('Email enabled:', preferences.email.enabled);

// Update preferences
await client.notifications.updatePreferences({
  email: { marketing: false },
  push: { enabled: true }
});

// Get unread notifications
const notifications = await client.notifications.getInApp({ includeRead: false });
console.log(`${notifications.length} unread notifications`);

// Mark notification as read
await client.notifications.markAsRead('notif_1234567890');

// Send game invites
const results = await client.notifications.sendGameInvites({
  emails: ['player1@example.com', 'player2@example.com'],
  gameId: 'game_abc123',
  message: 'Join our D&D campaign!'
});
console.log(`Sent ${results.sent} invites`);
```

### React Notifications Component
```jsx
import { useNotifications } from '@vtt-platform/react-components';

function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    clearAll,
    loading 
  } = useNotifications();

  return (
    <div className="notification-bell">
      <button className="bell-icon">
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      
      <div className="notification-dropdown">
        <div className="header">
          <h3>Notifications</h3>
          <button onClick={clearAll}>Clear All</button>
        </div>
        
        <div className="notifications">
          {notifications.map(notification => (
            <div 
              key={notification.id}
              className={`notification ${notification.type} ${notification.read ? 'read' : 'unread'}`}
              onClick={() => markAsRead(notification.id)}
            >
              <h4>{notification.title}</h4>
              <p>{notification.message}</p>
              <span className="time">
                {formatTime(notification.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const { preferences, updatePreferences } = useNotifications();
  
  const handleToggle = (category, type, value) => {
    updatePreferences({
      [category]: {
        [type]: value
      }
    });
  };
  
  return (
    <div className="notification-settings">
      <h2>Notification Preferences</h2>
      
      <div className="category">
        <h3>Email Notifications</h3>
        <label>
          <input
            type="checkbox"
            checked={preferences.email.account}
            onChange={(e) => handleToggle('email', 'account', e.target.checked)}
          />
          Account notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.email.game}
            onChange={(e) => handleToggle('email', 'game', e.target.checked)}
          />
          Game notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.email.marketing}
            onChange={(e) => handleToggle('email', 'marketing', e.target.checked)}
          />
          Marketing emails
        </label>
      </div>
    </div>
  );
}
```

## Real-time Notifications

### WebSocket Events
In-app notifications are delivered in real-time via WebSocket:

```javascript
// Subscribe to notification events
socket.on('notification:created', (notification) => {
  console.log('New notification:', notification);
  // Update UI with new notification
});

socket.on('notification:read', (notificationId) => {
  console.log('Notification read:', notificationId);
  // Update notification state
});
```

### Server-Sent Events (SSE)
Alternative real-time delivery via Server-Sent Events:

```javascript
const eventSource = new EventSource('/notifications/stream');

eventSource.onmessage = function(event) {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
};
```

## Testing

### Test Notifications
Development environment provides test endpoints:

```http
POST /notifications/test/create-sample
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "type": "success",
  "title": "Test Notification",
  "message": "This is a test notification for development"
}
```

### Mock Delivery
Use headers to simulate delivery states:
- `X-Mock-Email-Bounce: true` - Simulate email bounce
- `X-Mock-Push-Fail: true` - Simulate push failure
- `X-Mock-Delivery-Delay: 5000` - Add delivery delay (ms)

---

For more information, see the [Main API Documentation](./README.md).
