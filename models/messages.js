const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  text: {
    type: String,
    default: ""
  },
  media: {
    type: String,  // optional media URL (image, video)
    default: null
  },
  readBy: [
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" } // who has read the message
  ]
}, { timestamps: true });

// Optimized index for fetching latest messages in a conversation
MessageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message;
