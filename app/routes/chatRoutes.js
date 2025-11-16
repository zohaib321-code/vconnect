// chatRoutes.js
const express = require("express");
const router = express.Router();
const Conversation = require("../../models/conversations");
const Message = require("../../models/messages");

//----------------------------------------------------
// 1. Create/Get Private Conversation
//----------------------------------------------------
router.post("/conversation", async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "User IDs required" });
    }

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userId1, userId2] },
      type: "private",
    });

    if (!conversation) {
      // Create a new one
      conversation = await Conversation.create({
        participants: [userId1, userId2],
        unreadCounts: {
          [userId1]: 0,
          [userId2]: 0,
        },
      });
    }

    res.json(conversation);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 2. Get all conversations for a user
//----------------------------------------------------
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name phone avatar")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 3. Get messages of a conversation
//----------------------------------------------------
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 }) // ascending (oldest → newest)
      .populate("sender", "name phone avatar");

    res.json(messages);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 4. Send a new message
//----------------------------------------------------
router.post("/message", async (req, res) => {
  try {
    const { conversationId, sender, text, media } = req.body;

    if (!conversationId || !sender) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create message
    const message = await Message.create({
      conversationId,
      sender,
      text: text || "",
      media: media || null,
      delivered: [], // will update later
      readBy: [sender], // sender has "read" his own message
    });

    // Update conversation last message & unread counts
    const conversation = await Conversation.findById(conversationId);

    conversation.lastMessage = {
      text: text || (media ? "📷 Photo" : ""),
      timestamp: new Date(),
    };

    // Increase unread count for other participants
    conversation.participants.forEach((userId) => {
      if (String(userId) !== String(sender)) {
        conversation.unreadCounts.set(
          userId,
          (conversation.unreadCounts.get(userId) || 0) + 1
        );
      }
    });

    await conversation.save();

    res.json({ message, conversation });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 5. Mark messages as "read"
//----------------------------------------------------
router.post("/messages/mark-read", async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId },
      },
      {
        $push: { readBy: userId },
      }
    );

    // Reset unread count in conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCounts.${userId}`]: 0 },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 6. Delete a message
//----------------------------------------------------
router.delete("/message/:messageId", async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.messageId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 7. Delete entire conversation (optional)
//----------------------------------------------------
router.delete("/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.deleteMany({ conversationId });
    await Conversation.findByIdAndDelete(conversationId);

    res.json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
