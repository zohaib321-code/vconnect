const express = require('express');
const router = express.Router();

const Post = require('../../models/communityposts');
const Comment = require('../../models/comments');
const Reply = require('../../models/replies');

// ==========================
// 🔹 POST ROUTES
// ==========================

// Create a new post
router.post('/posts', async (req, res) => {
  try {
    const { userId, title, description, postMedia } = req.body;
    const post = new Post({ userId, title, description, postMedia });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all posts (newest first)
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name profilePic')
      .populate({
        path: 'comments',
        populate: [
          { path: 'userId', select: 'name profilePic' },
          {
            path: 'replies',
            populate: { path: 'userId', select: 'name profilePic' },
          },
        ],
      });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like / Unlike a post
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) return res.status(404).json({ message: 'Post not found' });

    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.json({ likes: post.likes.length, liked: !alreadyLiked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================
// 💬 COMMENT ROUTES
// ==========================

// Add a comment to a post
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const postId = req.params.postId;

    const comment = new Comment({ postId, userId, text });
    await comment.save();

    await Post.findByIdAndUpdate(postId, { $push: { comments: comment._id } });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name profilePic')
      .populate({
        path: 'replies',
        populate: { path: 'userId', select: 'name profilePic' },
      });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================
// 💭 REPLY ROUTES
// ==========================

// Add a reply to a comment
router.post('/comments/:commentId/replies', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const commentId = req.params.commentId;

    const reply = new Reply({ commentId, userId, text });
    await reply.save();

    await Comment.findByIdAndUpdate(commentId, { $push: { replies: reply._id } });

    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all replies for a comment
router.get('/comments/:commentId/replies', async (req, res) => {
  try {
    const replies = await Reply.find({ commentId: req.params.commentId })
      .sort({ createdAt: 1 })
      .populate('userId', 'name profilePic');

    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
