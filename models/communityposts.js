const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  postMedia: {
    type: String, // single image or video URL
    required: false
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }]
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);

postSchema.index({ userId: 1, createdAt: -1 }); // get user's latest posts fast
postSchema.index({ createdAt: -1 });            // feed sorting
postSchema.index({ title: 'text', description: 'text' });

module.exports = Post;
