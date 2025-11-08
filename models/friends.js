const mongoose = require('mongoose');

const FriendshipSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted"], default: "pending" },
}, { timestamps: true });

// Prevent duplicate friend requests between the same pair
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Query optimization for fetching all friends of a user
FriendshipSchema.index({ requester: 1, status: 1 });
FriendshipSchema.index({ recipient: 1, status: 1 });

const Friendship = mongoose.model('Friendship', FriendshipSchema);
module.exports = Friendship;
