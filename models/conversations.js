const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: {
    text: String,
    timestamp: Date
  },
  unreadCounts: { type: Map, of: Number, default: {} },
  type: { type: String, enum: ["private", "group"], default: "private" },
}, { timestamps: true });

// Index for fast fetching of conversations for a user, sorted by recent activity
ConversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = Conversation;
