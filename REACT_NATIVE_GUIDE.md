# React Native Socket.IO Integration Guide

**Complete implementation guide for integrating Socket.IO real-time chat in your React Native app.**

> [!IMPORTANT]
> This guide provides **detailed instructions** for implementing the chat system. It does NOT include full code blocks - instead, it explains what to do, how to structure your code, and what logic to implement. This allows another AI instance to understand the architecture and implement it correctly.

---

## 📋 Table of Contents

1. [Server Architecture Overview](#server-architecture-overview)
2. [Database Models](#database-models)
3. [Socket.IO Events Reference](#socketio-events-reference)
4. [REST API Endpoints](#rest-api-endpoints)
5. [React Native Implementation Steps](#react-native-implementation-steps)
6. [Key Implementation Details](#key-implementation-details)
7. [Testing Checklist](#testing-checklist)

---

## 🏗️ Server Architecture Overview

### Server URL
- **Base URL**: `http://localhost:5000`
- **Socket.IO Server**: Same URL with Socket.IO protocol
- **CORS**: Currently set to `*` (configure for production)

### Authentication
- **Method**: JWT (JSON Web Tokens)
- **Storage**: AsyncStorage in React Native
- **Token Key**: `userToken`
- **User ID Key**: `userId`
- **Socket Auth**: Token passed in `auth.token` during connection

### Connection Pattern (Like WhatsApp/Messenger)
1. User opens app → Socket connects **once** with JWT authentication
2. Server **automatically joins** user to ALL their conversation rooms
3. User receives messages from ALL conversations (for notifications)
4. Connection stays open throughout app session
5. User closes app → Socket disconnects

---

## 🗄️ Database Models

### User Model (`models/user.js`)
```
Fields:
- _id: ObjectId (auto-generated)
- name: String
- phone: Number (unique, required)
- email: String (unique, sparse)
- password: String (hashed with bcrypt)
- active: String (required)
- type: String (required - "volunteer" or "organization")
- pushToken: String (for push notifications)
- timestamps: createdAt, updatedAt
```

### Profile Model (`models/userProfile.js`)
```
Collection Name: "profiles"
Fields:
- _id: ObjectId (auto-generated)
- userId: ObjectId (ref: User, required)
- Name: String
- bio: String
- profilePicture: String (URL)
- skills: [String]
- interests: [String]
- isBloodDonor: Boolean (default: false)
- bloodGroup: String (enum: A+, A-, B+, B-, O+, O-, AB+, AB-)
- timestamps: createdAt, updatedAt
```

### Conversation Model (`models/conversations.js`)
```
Fields:
- _id: ObjectId (auto-generated)
- participants: [ObjectId] (ref: User)
- lastMessage: {
    text: String,
    timestamp: Date
  }
- unreadCounts: Map<String, Number> (userId -> unread count)
- type: String (enum: "private", "group", default: "private")
- timestamps: createdAt, updatedAt

Indexes:
- { participants: 1, updatedAt: -1 } for fast conversation fetching
```

### Message Model (`models/messages.js`)
```
Fields:
- _id: ObjectId (auto-generated)
- conversationId: ObjectId (ref: Conversation, required)
- sender: ObjectId (ref: User, required)
- text: String (default: "")
- media: String (optional URL for image/video)
- delivered: [Boolean] (default: false)
- readBy: [ObjectId] (ref: User - array of users who read the message)
- timestamps: createdAt, updatedAt

Indexes:
- { conversationId: 1, createdAt: -1 } for fast message fetching
```

---

## 🔌 Socket.IO Events Reference

### Client → Server Events (Emit)

#### 1. `join_conversation` (Optional - Auto-join handles this)
```javascript
socket.emit('join_conversation', conversationId);
```
**Purpose**: Manually join a conversation room  
**When**: Not needed since server auto-joins on connect  
**Parameters**: conversationId (String)

#### 2. `leave_conversation` (Optional)
```javascript
socket.emit('leave_conversation', conversationId);
```
**Purpose**: Leave a conversation room  
**When**: When user wants to stop receiving updates  
**Parameters**: conversationId (String)

#### 3. `send_message` (Primary messaging)
```javascript
socket.emit('send_message', {
  conversationId: 'conversation_id',
  text: 'Hello!',
  media: null // or URL string
});
```
**Purpose**: Send a message in real-time  
**When**: User sends a message  
**Parameters**:
- `conversationId` (String, required)
- `text` (String, optional if media present)
- `media` (String URL, optional)

**Server Response**: Broadcasts `new_message` event to all participants

#### 4. `typing` (Typing indicator)
```javascript
socket.emit('typing', {
  conversationId: 'conversation_id',
  isTyping: true // or false
});
```
**Purpose**: Notify others when user is typing  
**When**: User types in input field  
**Parameters**:
- `conversationId` (String, required)
- `isTyping` (Boolean, required)

**Best Practice**: Set timeout to auto-send `isTyping: false` after 2 seconds of inactivity

#### 5. `mark_read` (Read receipts)
```javascript
socket.emit('mark_read', {
  conversationId: 'conversation_id'
});
```
**Purpose**: Mark all messages in conversation as read  
**When**: User opens/focuses chat screen  
**Parameters**:
- `conversationId` (String, required)

**Server Response**: Broadcasts `messages_read` event to all participants

#### 6. `delete_message` (Message deletion)
```javascript
socket.emit('delete_message', {
  messageId: 'message_id',
  conversationId: 'conversation_id'
});
```
**Purpose**: Delete a message  
**When**: User deletes their message  
**Parameters**:
- `messageId` (String, required)
- `conversationId` (String, required)

**Server Response**: Broadcasts `message_deleted` event to all participants

---

### Server → Client Events (Listen)

#### 1. `connect` (Connection established)
```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```
**When**: Socket successfully connects  
**Data**: None (use `socket.id` for connection ID)

#### 2. `disconnect` (Connection lost)
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected');
});
```
**When**: Socket disconnects  
**Data**: None

#### 3. `connect_error` (Authentication/connection error)
```javascript
socket.on('connect_error', (error) => {
  console.error('Error:', error.message);
});
```
**When**: Authentication fails or connection error  
**Data**: Error object with `message` property

#### 4. `new_message` (New message received)
```javascript
socket.on('new_message', (data) => {
  // data.message = populated message object
  // data.conversation = updated conversation object
});
```
**When**: Any user sends a message in a conversation you're part of  
**Data Structure**:
```
{
  message: {
    _id: String,
    conversationId: String,
    sender: {
      _id: String,
      name: String,
      phone: String,
      avatar: String
    },
    text: String,
    media: String | null,
    readBy: [String],
    createdAt: Date,
    updatedAt: Date
  },
  conversation: {
    _id: String,
    participants: [String],
    lastMessage: {
      text: String,
      timestamp: Date
    },
    unreadCounts: Map<String, Number>
  }
}
```

**Implementation Notes**:
- Listen in **ChatListScreen** to update conversation previews
- Listen in **ChatScreen** to add new messages to chat
- Check `data.message.conversationId` to determine which conversation

#### 5. `user_typing` (Typing indicator)
```javascript
socket.on('user_typing', (data) => {
  // data.userId = who is typing
  // data.conversationId = which conversation
  // data.isTyping = true/false
});
```
**When**: Another user types in a conversation  
**Data Structure**:
```
{
  userId: String,
  conversationId: String,
  isTyping: Boolean
}
```

**Implementation Notes**:
- Only show if `data.userId !== currentUserId`
- Only show if `data.conversationId === currentConversationId`
- Display "User is typing..." when `isTyping === true`

#### 6. `messages_read` (Read receipts)
```javascript
socket.on('messages_read', (data) => {
  // data.userId = who read the messages
  // data.conversationId = which conversation
});
```
**When**: Another user marks messages as read  
**Data Structure**:
```
{
  userId: String,
  conversationId: String
}
```

**Implementation Notes**:
- Update message `readBy` arrays
- Update conversation `unreadCounts` to 0 for that user
- Show double checkmarks or "Read" status

#### 7. `message_deleted` (Message deletion)
```javascript
socket.on('message_deleted', (data) => {
  // data.messageId = which message was deleted
  // data.conversationId = which conversation
});
```
**When**: A message is deleted  
**Data Structure**:
```
{
  messageId: String,
  conversationId: String
}
```

**Implementation Notes**:
- Remove message from UI
- Or replace with "This message was deleted"

#### 8. `user_online` (User came online)
```javascript
socket.on('user_online', (data) => {
  // data.userId = who came online
});
```
**When**: A user connects to Socket.IO  
**Data Structure**:
```
{
  userId: String
}
```

#### 9. `user_offline` (User went offline)
```javascript
socket.on('user_offline', (data) => {
  // data.userId = who went offline
});
```
**When**: A user disconnects from Socket.IO  
**Data Structure**:
```
{
  userId: String
}
```

---

## 🌐 REST API Endpoints

### Authentication Endpoints

#### POST `/auth/register`
**Purpose**: Register new user  
**Headers**: `Content-Type: application/json`  
**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "userType": "volunteer"
}
```
**Response**: User object + JWT token

#### POST `/auth/login`
**Purpose**: Login user  
**Headers**: `Content-Type: application/json`  
**Body**:
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```
**Response**: User object + JWT token

---

### Chat Endpoints (All require Authorization header)

**Authorization Header Format**: `Authorization: Bearer <jwt-token>`

#### POST `/conversation`
**Purpose**: Create or get existing private conversation  
**Body**:
```json
{
  "userId1": "user1_id",
  "userId2": "user2_id"
}
```
**Response**: Conversation object  
**Notes**: If conversation exists, returns existing one

#### GET `/conversations/:userId`
**Purpose**: Get all conversations for a user  
**Parameters**: `userId` in URL  
**Response**: Array of conversation objects with populated participant profiles  
**Response Structure**:
```json
[
  {
    "_id": "conv_id",
    "participants": ["user1_id", "user2_id"],
    "lastMessage": {
      "text": "Hello",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "type": "private",
    "unreadCounts": {
      "user1_id": 0,
      "user2_id": 2
    },
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "participantProfiles": [
      {
        "_id": "profile_id",
        "userId": "user1_id",
        "Name": "John Doe",
        "profilePicture": "url"
      }
    ]
  }
]
```

#### GET `/conversation/:conversationId`
**Purpose**: Get single conversation with participant profiles  
**Parameters**: `conversationId` in URL  
**Response**: Single conversation object (same structure as above)

#### GET `/messages/:conversationId`
**Purpose**: Get all messages in a conversation  
**Parameters**: `conversationId` in URL  
**Response**: Array of message objects (sorted oldest to newest)  
**Response Structure**:
```json
[
  {
    "_id": "msg_id",
    "conversationId": "conv_id",
    "sender": {
      "_id": "user_id",
      "name": "John Doe",
      "phone": "+1234567890",
      "avatar": "url"
    },
    "text": "Hello!",
    "media": null,
    "readBy": ["user_id"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/message`
**Purpose**: Send a message (HTTP fallback - prefer Socket.IO)  
**Body**:
```json
{
  "conversationId": "conv_id",
  "sender": "user_id",
  "text": "Hello!",
  "media": null
}
```
**Response**: Message object + updated conversation  
**Notes**: Also emits Socket.IO `new_message` event

#### POST `/messages/mark-read`
**Purpose**: Mark messages as read (HTTP fallback - prefer Socket.IO)  
**Body**:
```json
{
  "conversationId": "conv_id",
  "userId": "user_id"
}
```
**Response**: `{ "success": true }`  
**Notes**: Also emits Socket.IO `messages_read` event

#### DELETE `/message/:messageId?conversationId=conv_id`
**Purpose**: Delete a message  
**Parameters**: 
- `messageId` in URL
- `conversationId` in query string
**Response**: `{ "success": true }`  
**Notes**: Also emits Socket.IO `message_deleted` event

#### DELETE `/conversation/:conversationId`
**Purpose**: Delete entire conversation and all messages  
**Parameters**: `conversationId` in URL  
**Response**: `{ "success": true }`

---

## 📱 React Native Implementation Steps

### Step 1: Install Dependencies

**Required Packages**:
```bash
npm install socket.io-client @react-native-async-storage/async-storage
```

**Optional (for navigation)**:
```bash
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
```

---

### Step 2: Create Socket Context

**File**: `contexts/SocketContext.js`

**Purpose**: Manage single Socket.IO connection across entire app

**Implementation Requirements**:

1. **Create Context**:
   - Create `SocketContext` using `createContext()`
   - Export `useSocket()` hook that returns context
   - Throw error if used outside provider

2. **SocketProvider Component**:
   - State: `socket` (Socket.IO instance), `isConnected` (Boolean)
   - On mount: Initialize socket connection
   - Get JWT token from AsyncStorage (key: `userToken`)
   - If no token, skip connection
   - Create socket with:
     - URL: `http://localhost:5000`
     - Config: `{ auth: { token }, transports: ['websocket'], reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000 }`
   - Listen for `connect` event → set `isConnected` to true
   - Listen for `disconnect` event → set `isConnected` to false
   - Listen for `connect_error` event → log error, set `isConnected` to false
   - On unmount: Disconnect socket
   - Provide `{ socket, isConnected }` to children

**Key Points**:
- Socket connects ONCE when app starts
- Server auto-joins user to all conversations
- Socket stays connected throughout app session
- Reconnects automatically if connection drops

---

### Step 3: Wrap App with SocketProvider

**File**: `App.js`

**Implementation**:
- Import `SocketProvider` from `contexts/SocketContext`
- Wrap entire app (including NavigationContainer) with `<SocketProvider>`
- This ensures socket is available everywhere

**Structure**:
```
<SocketProvider>
  <NavigationContainer>
    <AppNavigator />
  </NavigationContainer>
</SocketProvider>
```

---

### Step 4: Create Chat List Screen

**File**: `screens/ChatListScreen.js`

**Purpose**: Display all conversations with real-time updates

**State Requirements**:
- `conversations`: Array of conversation objects
- `userId`: Current user's ID (from AsyncStorage)

**On Mount**:
1. Load `userId` from AsyncStorage (key: `userId`)
2. Fetch conversations from `GET /conversations/:userId`
3. Store in `conversations` state

**Socket Event Listeners** (useEffect with `socket` dependency):

1. **Listen for `new_message`**:
   - When received, check if `data.message.conversationId` matches any conversation
   - Update that conversation's `lastMessage` and `unreadCounts`
   - Optionally show notification if not in that chat

2. **Listen for `messages_read`**:
   - When received, update conversation's `unreadCounts` for that user to 0

3. **Cleanup**: Remove listeners on unmount

**Rendering Logic**:

1. **FlatList** with `conversations` data
2. For each conversation:
   - Get other participant from `participantProfiles` (filter out current user)
   - Display: avatar, name, last message text, timestamp
   - Display unread count badge if `unreadCounts[userId] > 0`
   - Make bold if unread
3. **Pull to refresh**: Reload conversations
4. **Connection indicator**: Green dot if `isConnected`, red if not

**Navigation**:
- On conversation tap: Navigate to `ChatScreen` with params:
  - `conversationId`: Conversation ID
  - `otherUser`: Other participant's profile object

**Helper Functions**:
- `getOtherParticipant(conversation)`: Returns profile of other user
- `getUnreadCount(conversation)`: Returns `conversation.unreadCounts[userId] || 0`
- `formatTimestamp(timestamp)`: Returns "Just now", "5m ago", "2h ago", or date

---

### Step 5: Create Chat Screen

**File**: `screens/ChatScreen.js`

**Purpose**: Display messages in a conversation with real-time updates

**Route Params**:
- `conversationId`: String
- `otherUser`: Profile object

**State Requirements**:
- `messages`: Array of message objects
- `inputText`: String (current input)
- `userId`: Current user's ID
- `isTyping`: Boolean (is other user typing)

**Refs**:
- `flatListRef`: For auto-scrolling to bottom
- `typingTimeoutRef`: For typing indicator timeout

**On Mount**:
1. Load `userId` from AsyncStorage
2. Fetch messages from `GET /messages/:conversationId`
3. Store in `messages` state
4. Emit `mark_read` event with `{ conversationId }`

**Socket Event Listeners** (useEffect with `socket`, `conversationId`, `userId` dependencies):

1. **Listen for `new_message`**:
   - Check if `data.message.conversationId === conversationId`
   - If yes, append `data.message` to `messages` array
   - Auto-scroll to bottom after 100ms

2. **Listen for `user_typing`**:
   - Check if `data.conversationId === conversationId` AND `data.userId !== userId`
   - If yes, set `isTyping` to `data.isTyping`

3. **Listen for `messages_read`**:
   - Check if `data.conversationId === conversationId`
   - Update all messages: add `data.userId` to `readBy` array

4. **Cleanup**: Remove listeners on unmount

**Send Message Logic**:
1. Trim input text
2. If empty or no socket, return
3. Emit `send_message` event with:
   ```javascript
   {
     conversationId,
     text: inputText.trim(),
     media: null
   }
   ```
4. Clear input
5. Emit `typing` event with `{ conversationId, isTyping: false }`

**Typing Indicator Logic**:
1. On text change:
   - Update `inputText` state
   - Emit `typing` event with `{ conversationId, isTyping: true }`
   - Clear previous timeout
   - Set new timeout (2 seconds) to emit `{ conversationId, isTyping: false }`

**Rendering Logic**:

1. **FlatList** with `messages` data
   - Ref: `flatListRef`
   - Auto-scroll on content size change

2. **Message Bubble**:
   - Check if `item.sender._id === userId` OR `item.sender === userId`
   - If yes: Align right, blue background, white text
   - If no: Align left, white background, black text
   - Display: message text, timestamp

3. **Typing Indicator**:
   - Show if `isTyping === true`
   - Display: "{otherUser.Name} is typing..."

4. **Input Container**:
   - TextInput with `inputText` value
   - On change: Call typing indicator logic
   - Send button: Call send message logic

**KeyboardAvoidingView**:
- Behavior: `padding` on iOS, `height` on Android
- Offset: 90 (adjust for header)

---

### Step 6: Create Start Conversation Function

**Purpose**: Create a new conversation before navigating to ChatScreen

**Implementation Location**: ChatListScreen or separate utility

**Logic**:
1. Call `POST /conversation` with:
   ```json
   {
     "userId1": currentUserId,
     "userId2": otherUserId
   }
   ```
2. Get conversation object from response
3. Navigate to ChatScreen with:
   - `conversationId`: response._id
   - `otherUser`: other user's profile

**Usage**: When user selects a user to chat with from user list

---

## 🔑 Key Implementation Details

### Auto-Join Mechanism

**Server Side** (`app/socketHandler.js`):
- On socket connection, server queries all conversations where user is a participant
- Joins socket to each conversation room using `socket.join(conversationId)`
- This happens automatically - no client action needed

**Client Side**:
- Just connect socket with JWT token
- Server handles room joining
- Client receives messages from ALL conversations

**Benefits**:
- Receive messages even when not viewing that chat
- Show notifications for new messages
- Update chat list in real-time
- Single persistent connection (efficient)

---

### Message Delivery Flow

**Sending a Message**:
1. User types message in ChatScreen
2. Client emits `send_message` event via Socket.IO
3. Server receives event, creates message in database
4. Server updates conversation's `lastMessage` and `unreadCounts`
5. Server emits `new_message` event to ALL participants in conversation room
6. All clients receive event (including sender)
7. ChatScreen adds message to UI
8. ChatListScreen updates conversation preview

**Why Socket.IO over HTTP**:
- Instant delivery (no polling)
- Server can push to all participants simultaneously
- Efficient (single connection)
- Real-time typing indicators and read receipts

---

### Unread Count Management

**Structure**: `conversation.unreadCounts` is a Map<String, Number>
- Key: userId (String)
- Value: unread count (Number)

**Increment** (Server side):
- When message is sent, increment count for all participants except sender
- Formula: `unreadCounts[userId] = (unreadCounts[userId] || 0) + 1`

**Reset** (Client side):
- When user opens ChatScreen, emit `mark_read` event
- Server sets `unreadCounts[userId] = 0`
- Server broadcasts `messages_read` event
- All clients update UI

**Display** (Client side):
- In ChatListScreen, show badge if `conversation.unreadCounts[currentUserId] > 0`
- Make conversation bold if unread

---

### Read Receipts

**Message Model**: `readBy` is an array of user IDs who have read the message

**Mark as Read**:
1. User opens ChatScreen
2. Client emits `mark_read` event
3. Server updates all messages: `$push: { readBy: userId }`
4. Server broadcasts `messages_read` event
5. Clients update message UI (show checkmarks, "Read" status)

**Display Logic**:
- Single checkmark: Message sent
- Double checkmark: Message delivered (all participants received)
- Blue double checkmark: Message read (all participants read)

---

### Typing Indicators

**Flow**:
1. User types in input field
2. Client emits `typing` event with `{ conversationId, isTyping: true }`
3. Server broadcasts `user_typing` event to other participants
4. Other clients show "User is typing..." indicator
5. After 2 seconds of inactivity, client emits `{ conversationId, isTyping: false }`
6. Other clients hide typing indicator

**Best Practices**:
- Use timeout to auto-stop typing indicator
- Don't show typing indicator for current user
- Only show in current conversation

---

### Connection Status

**Tracking**:
- Listen for `connect` event → set `isConnected` to true
- Listen for `disconnect` event → set `isConnected` to false
- Display indicator in UI (green/red dot)

**Reconnection**:
- Socket.IO handles automatic reconnection
- Configure: `reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000`
- On reconnect, server auto-joins user to conversations again

---

### Error Handling

**Authentication Errors**:
- Listen for `connect_error` event
- Check `error.message` for "Authentication error"
- Redirect to login screen or refresh token

**Network Errors**:
- Socket.IO handles reconnection automatically
- Show "Connecting..." message while reconnecting
- Show "Offline" message if reconnection fails

**Message Send Failures**:
- If socket not connected, queue messages locally
- Send when connection restored
- Or show error message to user

---

## ✅ Testing Checklist

### Socket Connection
- [ ] Socket connects on app start with valid token
- [ ] Socket doesn't connect without token
- [ ] Socket reconnects after network interruption
- [ ] Connection status indicator updates correctly
- [ ] Authentication error shows on invalid token

### Chat List
- [ ] Conversations load on screen mount
- [ ] New message updates conversation preview
- [ ] Unread count increments on new message
- [ ] Unread count resets when opening chat
- [ ] Last message text updates in real-time
- [ ] Timestamp formats correctly
- [ ] Pull to refresh reloads conversations
- [ ] Other participant's profile displays correctly

### Chat Screen
- [ ] Messages load on screen mount
- [ ] New message appears instantly
- [ ] Sent messages appear in UI
- [ ] Messages align correctly (left/right)
- [ ] Auto-scroll to bottom on new message
- [ ] Typing indicator shows when other user types
- [ ] Typing indicator hides after 2 seconds
- [ ] Read receipts update correctly
- [ ] Keyboard avoiding works on iOS/Android

### Real-Time Features
- [ ] Message delivery is instant (< 1 second)
- [ ] Typing indicator appears/disappears correctly
- [ ] Read receipts update in real-time
- [ ] Multiple conversations update independently
- [ ] Notifications show for messages in other chats

### Edge Cases
- [ ] Handle empty conversations
- [ ] Handle conversations with no messages
- [ ] Handle long messages (text wrapping)
- [ ] Handle rapid message sending
- [ ] Handle socket disconnect during send
- [ ] Handle app backgrounding/foregrounding
- [ ] Handle multiple devices logged in

---

## 🎯 Summary for AI Implementation

**When implementing this system, remember**:

1. **Single Socket Connection**: Create socket ONCE in SocketContext, share everywhere
2. **Auto-Join**: Server joins user to all conversations automatically on connect
3. **Event Listeners**: Set up in useEffect with proper cleanup
4. **State Management**: Use React state for messages, conversations, typing indicators
5. **Real-Time Updates**: Listen for events in BOTH ChatListScreen and ChatScreen
6. **Error Handling**: Handle authentication errors, network errors, send failures
7. **User Experience**: Auto-scroll, typing indicators, read receipts, connection status
8. **Data Flow**: Socket.IO for real-time, REST API for initial data loading

**Server is already implemented** - just connect to it correctly from React Native!

---

## 📚 Additional Resources

- **Server Code**: See `app/socketHandler.js` for Socket.IO event handlers
- **API Routes**: See `app/routes/chatRoutes.js` for REST endpoints
- **Models**: See `models/` directory for database schemas
- **README**: See `README.md` for complete API documentation

**Good luck implementing! 🚀**
