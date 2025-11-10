const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const replySchema = new Schema({
  commentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Reply = mongoose.model('Reply', replySchema);

replySchema.index({ commentId: 1, createdAt: 1 }); // quick replies per comment
replySchema.index({ userId: 1 });                  // find all replies by user (if ever needed)

module.exports = Reply;
