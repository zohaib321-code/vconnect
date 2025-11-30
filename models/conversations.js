const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: {
    text: String,
    timestamp: Date
  },
  unreadCounts: { type: Map, of: Number, default: {} },
  type: { type: String, enum: ["private", "group"], default: "private" },
  name: { type: String, required: false }, // Group chat name
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "Opportunity", required: false }, // Link to opportunity
}, { timestamps: true });

// Index for fast fetching of conversations for a user, sorted by recent activity
ConversationSchema.index({ participants: 1, updatedAt: -1 });

// Index for fast fetching of group chats by opportunity
ConversationSchema.index({ opportunityId: 1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = Conversation;
