const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
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
  },
  replies: [{
    type: Schema.Types.ObjectId,
    ref: 'Reply'
  }]
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);

commentSchema.index({ postId: 1, createdAt: -1 }); // fast comment fetch per post
commentSchema.index({ userId: 1 });                // get all comments by user

module.exports = Comment;
