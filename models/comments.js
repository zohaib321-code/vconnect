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


commentSchema.virtual('author', {
  ref: 'Profile',          // model to populate
  localField: 'userId',    // field in Comment
  foreignField: 'userId',  // field in Profile
  justOne: true            // one profile per comment
});

commentSchema.set('toObject', { virtuals: true });
commentSchema.set('toJSON', { virtuals: true });

commentSchema.index({ postId: 1, createdAt: -1 }); // fast comment fetch per post
commentSchema.index({ userId: 1 });                // get all comments by user



const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
