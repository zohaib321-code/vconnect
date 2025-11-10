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


replySchema.virtual('author', {
  ref: 'Profile',
  localField: 'userId',
  foreignField: 'userId',
  justOne: true
});

replySchema.set('toObject', { virtuals: true });
replySchema.set('toJSON', { virtuals: true });

replySchema.index({ commentId: 1, createdAt: 1 }); // quick replies per comment
replySchema.index({ userId: 1 });    

const Reply = mongoose.model('Reply', replySchema);

module.exports = Reply;
