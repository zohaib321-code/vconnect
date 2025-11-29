# VConnect Backend API

A comprehensive Node.js backend API for the VConnect social volunteering platform with real-time chat functionality powered by Socket.IO.

## Features

- 🔐 **Authentication & Authorization** - JWT-based authentication with role-based access control
- 💬 **Real-Time Chat** - Socket.IO powered instant messaging with typing indicators and read receipts
- 👥 **User Management** - Profile creation, updates, and user discovery
- 🎯 **Opportunities** - Volunteer opportunity creation and registration
- 🏢 **Organization Profiles** - Organization management and verification
- 📱 **Social Features** - Posts, comments, follows, and friends
- 🔔 **Push Notifications** - Expo push notification integration
- 📸 **Media Management** - Cloudinary integration for image uploads
- 👥 **Community** - Community posts and discussions

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Real-Time**: Socket.IO
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Cloudinary
- **Push Notifications**: Expo Server SDK
- **Email**: Nodemailer

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- Cloudinary account for media storage
- Email account for sending OTPs

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vcon_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Email Configuration
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password

   # JWT Secret
   JWT_SECRET=your-secret-key-here

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   The server will run on `http://localhost:5000`

## API Documentation

### Base URL
```
http://localhost:5000
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "userType": "volunteer" // or "organization"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Request OTP
```http
POST /auth/request-otp
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Verify OTP
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Chat Endpoints

All chat endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Create/Get Private Conversation
```http
POST /conversation
Content-Type: application/json

{
  "userId1": "user1_id",
  "userId2": "user2_id"
}
```

#### Get All Conversations for a User
```http
GET /conversations/:userId
```

#### Get Single Conversation
```http
GET /conversation/:conversationId
```

#### Get Messages in a Conversation
```http
GET /messages/:conversationId
```

#### Send a Message
```http
POST /message
Content-Type: application/json

{
  "conversationId": "conversation_id",
  "sender": "user_id",
  "text": "Hello!",
  "media": "optional_media_url"
}
```

#### Mark Messages as Read
```http
POST /messages/mark-read
Content-Type: application/json

{
  "conversationId": "conversation_id",
  "userId": "user_id"
}
```

#### Delete a Message
```http
DELETE /message/:messageId?conversationId=conversation_id
```

#### Delete Conversation
```http
DELETE /conversation/:conversationId
```

### User Endpoints

#### Get User Profile
```http
GET /profile/:userId
```

#### Update User Profile
```http
PUT /profile/:userId
Content-Type: application/json

{
  "Name": "Updated Name",
  "Bio": "Updated bio",
  "profilePicture": "image_url"
}
```

### Opportunity Endpoints

#### Create Opportunity
```http
POST /opportunity/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Beach Cleanup",
  "description": "Help clean the beach",
  "location": "Santa Monica Beach",
  "date": "2024-12-01",
  "volunteersNeeded": 20
}
```

#### Get All Opportunities
```http
GET /opportunity/all
```

#### Register for Opportunity
```http
POST /oppRegistration/register
Content-Type: application/json

{
  "opportunityId": "opp_id",
  "userId": "user_id"
}
```

### Social Endpoints

#### Create Post
```http
POST /post
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user_id",
  "content": "Post content",
  "media": ["image_url"]
}
```

#### Get User Feed
```http
GET /feed/:userId
```

#### Follow User
```http
POST /follow
Content-Type: application/json

{
  "followerId": "user_id",
  "followingId": "target_user_id"
}
```

### Media Endpoints

#### Upload Image
```http
POST /media/upload
Content-Type: multipart/form-data

{
  "image": <file>
}
```

## Socket.IO Real-Time Events

### How It Works

**Connection Pattern (Like WhatsApp/Messenger):**
1. User opens app → Socket connects **once** with JWT authentication
2. Server **automatically joins** user to ALL their conversation rooms
3. User receives messages from ALL conversations (for notifications)
4. Connection stays open throughout app session
5. User closes app → Socket disconnects

**Key Benefits:**
- ✅ Receive messages from all chats even when not viewing them
- ✅ Show notifications for new messages
- ✅ Update chat list in real-time
- ✅ Single persistent connection (efficient)

### Client Connection

Connect to the Socket.IO server with JWT authentication:

```javascript
import io from 'socket.io-client';

// Connect ONCE when app starts
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// User is automatically joined to all their conversations!
// No need to manually join each conversation

// Listen for messages from ALL conversations
socket.on('new_message', (data) => {
  // Update chat list
  // Show notification if not in that specific chat
  console.log('New message in conversation:', data.message.conversationId);
});
```

### Events to Emit (Client → Server)

#### Join Conversation (Optional)
Manually join a conversation room (not needed since auto-join handles this):
```javascript
socket.emit('join_conversation', conversationId);
```

#### Leave Conversation (Optional)
Leave a conversation room:
```javascript
socket.emit('leave_conversation', conversationId);
```

> **Note:** Manual join/leave is optional. Users are automatically joined to all their conversations on connect.

#### Send Message
Send a message in real-time:
```javascript
socket.emit('send_message', {
  conversationId: 'conversation_id',
  text: 'Hello!',
  media: null // optional
});
```

#### Typing Indicator
Notify others when typing:
```javascript
socket.emit('typing', {
  conversationId: 'conversation_id',
  isTyping: true // or false
});
```

#### Mark as Read
Mark messages as read:
```javascript
socket.emit('mark_read', {
  conversationId: 'conversation_id'
});
```

#### Delete Message
Delete a message in real-time:
```javascript
socket.emit('delete_message', {
  messageId: 'message_id',
  conversationId: 'conversation_id'
});
```

### Events to Listen (Server → Client)

#### New Message
Receive new messages in real-time:
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data.message);
  console.log('Updated conversation:', data.conversation);
});
```

#### User Typing
Receive typing indicators:
```javascript
socket.on('user_typing', (data) => {
  console.log(`User ${data.userId} is typing: ${data.isTyping}`);
});
```

#### Messages Read
Receive read receipts:
```javascript
socket.on('messages_read', (data) => {
  console.log(`User ${data.userId} read messages in ${data.conversationId}`);
});
```

#### Message Deleted
Receive message deletion notifications:
```javascript
socket.on('message_deleted', (data) => {
  console.log(`Message ${data.messageId} deleted from ${data.conversationId}`);
});
```

#### User Online/Offline
Track user presence:
```javascript
socket.on('user_online', (data) => {
  console.log(`User ${data.userId} is online`);
});

socket.on('user_offline', (data) => {
  console.log(`User ${data.userId} is offline`);
});
```

#### Connection Error
Handle authentication errors:
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

## Frontend Integration Example

### React/React Native Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function ChatComponent({ conversationId, userId, token }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    // Join conversation
    newSocket.emit('join_conversation', conversationId);

    // Listen for new messages
    newSocket.on('new_message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    // Listen for typing indicators
    newSocket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => new Set(prev).add(data.userId));
      } else {
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.userId);
          return updated;
        });
      }
    });

    // Listen for read receipts
    newSocket.on('messages_read', (data) => {
      // Update message read status in UI
      console.log('Messages read by:', data.userId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_conversation', conversationId);
      newSocket.disconnect();
    };
  }, [conversationId, token]);

  const sendMessage = (text) => {
    if (socket) {
      socket.emit('send_message', {
        conversationId,
        text,
        media: null
      });
    }
  };

  const handleTyping = (isTyping) => {
    if (socket) {
      socket.emit('typing', {
        conversationId,
        isTyping
      });
    }
  };

  return (
    <div>
      {/* Your chat UI here */}
    </div>
  );
}
```

## Database Models

### User
- `name`: String
- `email`: String (unique)
- `phone`: String (unique)
- `password`: String (hashed)
- `userType`: String (volunteer/organization)
- `isVerified`: Boolean

### Profile
- `userId`: ObjectId (ref: User)
- `Name`: String
- `Bio`: String
- `profilePicture`: String
- `location`: String
- `interests`: [String]

### Conversation
- `participants`: [ObjectId] (ref: User)
- `lastMessage`: { text: String, timestamp: Date }
- `unreadCounts`: Map<String, Number>
- `type`: String (private/group)

### Message
- `conversationId`: ObjectId (ref: Conversation)
- `sender`: ObjectId (ref: User)
- `text`: String
- `media`: String
- `delivered`: [Boolean]
- `readBy`: [ObjectId] (ref: User)

## Error Handling

All endpoints return errors in the following format:
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Security Best Practices

1. **Environment Variables**: Never commit `.env` file to version control
2. **JWT Secret**: Use a strong, random secret key
3. **Password Hashing**: Passwords are hashed using bcrypt
4. **CORS**: Configure CORS origin in production to match your frontend URL
5. **Rate Limiting**: Consider adding rate limiting for production
6. **Input Validation**: Validate all user inputs
7. **SQL Injection**: MongoDB queries use parameterized queries

## Production Deployment

### Update CORS Configuration

In `app.js`, update the Socket.IO CORS settings:
```javascript
const io = new Server(server, {
  cors: {
    origin: "https://your-frontend-domain.com",
    methods: ["GET", "POST"]
  }
});
```

### Environment Variables

Set all environment variables in your production environment.

### MongoDB Connection

Update the MongoDB connection string in `app.js` or use an environment variable:
```javascript
const dburi = process.env.MONGODB_URI || "your-connection-string";
```

## Troubleshooting

### Socket.IO Connection Issues

1. **Authentication Error**: Ensure JWT token is valid and included in auth object
2. **CORS Error**: Update CORS configuration to include your frontend domain
3. **Connection Timeout**: Check network connectivity and server status

### Database Connection Issues

1. **MongoDB Atlas**: Whitelist your IP address in MongoDB Atlas
2. **Connection String**: Verify MongoDB connection string format
3. **Network**: Ensure network allows MongoDB connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues and questions, please create an issue in the repository.

---

**Built with ❤️ for the VConnect community**
