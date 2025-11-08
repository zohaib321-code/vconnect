const mongoose = require('mongoose');

const FollowSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // user who follows
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // org being followed
}, { timestamps: true });

// Prevent a user from following the same organization multiple times
FollowSchema.index({ follower: 1, organization: 1 }, { unique: true });

// Optional: index for querying all followers of an organization
FollowSchema.index({ organization: 1 });

const Follow = mongoose.model('Follow', FollowSchema);
module.exports = Follow;
