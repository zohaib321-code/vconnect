// socketHandler.js
const jwt = require('jsonwebtoken');
const Message = require('../models/messages');
const Conversation = require('../models/conversations');
const mongoose = require('mongoose');

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> socketId

function initializeSocket(io) {
  // Socket.IO authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Store active user
    activeUsers.set(socket.userId, socket.id);

    // Auto-join all user's conversations on connect
    try {
      const userConversations = await Conversation.find({
        participants: new mongoose.Types.ObjectId(socket.userId)
      }).select('_id');

      userConversations.forEach(conv => {
        socket.join(conv._id.toString());
      });

      console.log(`User ${socket.userId} auto-joined ${userConversations.length} conversations`);
    } catch (err) {
      console.error('Error auto-joining conversations:', err);
    }

    // Broadcast user online status
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // Join conversation room (manual join if needed)
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.userId} manually joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Real-time message sending
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, text, media } = data;
        const User = require('../models/user');
        const Profile = require('../models/userProfile');
        const { sendNewMessageNotification } = require('./utils/pushNotificationService');

        // Create message in database
        const message = await Message.create({
          conversationId: new mongoose.Types.ObjectId(conversationId),
          sender: new mongoose.Types.ObjectId(socket.userId),
          text: text || '',
          media: media || null,
          delivered: [],
          readBy: [new mongoose.Types.ObjectId(socket.userId)],
        });

        // Update conversation
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.lastMessage = {
            text: text || (media ? '📷 Photo' : ''),
            timestamp: new Date(),
          };

          // Increase unread count for other participants
          conversation.participants.forEach((userId) => {
            if (String(userId) !== String(socket.userId)) {
              conversation.unreadCounts.set(
                userId,
                (conversation.unreadCounts.get(userId) || 0) + 1
              );
            }
          });

          await conversation.save();
        }

        // Get sender's profile to include Name field
        const senderProfile = await Profile.findOne({ userId: socket.userId }).select('Name profilePicture');

        // Populate sender info from User model
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'phone avatar');

        // Create the message object with sender Name from Profile
        const messageWithProfile = {
          ...populatedMessage.toObject(),
          sender: {
            _id: populatedMessage.sender._id,
            Name: senderProfile?.Name || 'Unknown User',
            profilePicture: senderProfile?.profilePicture || null,
            phone: populatedMessage.sender.phone,
          }
        };

        // Emit to all users in the conversation room
        io.to(conversationId).emit('new_message', {
          message: messageWithProfile,
          conversation: conversation,
        });

        // Send push notifications to offline users
        if (conversation) {
          const recipientIds = conversation.participants.filter(
            userId => String(userId) !== String(socket.userId)
          );

          if (recipientIds.length > 0) {
            // Send push notifications asynchronously (don't await)
            sendNewMessageNotification(
              recipientIds,
              activeUsers,
              senderProfile?.Name || 'Someone',
              text || '📷 Photo',
              conversationId,
              message._id
            ).catch(err => console.error('Push notification error:', err));
          }
        }

      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      socket.to(conversationId).emit('user_typing', {
        userId: socket.userId,
        conversationId,
        isTyping,
      });
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data;

        // Update messages
        await Message.updateMany(
          {
            conversationId: new mongoose.Types.ObjectId(conversationId),
            readBy: { $ne: new mongoose.Types.ObjectId(socket.userId) },
          },
          { $push: { readBy: new mongoose.Types.ObjectId(socket.userId) } }
        );

        // Update conversation unread count
        await Conversation.findByIdAndUpdate(
          new mongoose.Types.ObjectId(conversationId),
          {
            $set: { [`unreadCounts.${socket.userId}`]: 0 },
          }
        );

        // Notify other participants
        socket.to(conversationId).emit('messages_read', {
          userId: socket.userId,
          conversationId,
        });

      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    });

    // Message deletion
    socket.on('delete_message', async (data) => {
      try {
        const { messageId, conversationId } = data;

        await Message.findByIdAndDelete(new mongoose.Types.ObjectId(messageId));

        // Notify all users in conversation
        io.to(conversationId).emit('message_deleted', {
          messageId,
          conversationId,
        });

      } catch (err) {
        console.error('Error deleting message:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      activeUsers.delete(socket.userId);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });
}

// Helper function to get socket.io instance in routes
let ioInstance = null;

function setSocketInstance(io) {
  ioInstance = io;
}

function getSocketInstance() {
  return ioInstance;
}

module.exports = {
  initializeSocket,
  setSocketInstance,
  getSocketInstance,
  activeUsers,
};
