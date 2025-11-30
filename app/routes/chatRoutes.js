// chatRoutes.js
const express = require("express");
const mongoose = require("mongoose");
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

    // Convert to ObjectId for consistency
    const objId1 = new mongoose.Types.ObjectId(userId1);
    const objId2 = new mongoose.Types.ObjectId(userId2);

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [objId1, objId2] },
      type: "private",
    });

    if (!conversation) {
      // Create a new one
      conversation = await Conversation.create({
        participants: [objId1, objId2],
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
// 2. Get all conversations for a user (with Profile info)
//----------------------------------------------------
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.aggregate([
      { $match: { participants: new mongoose.Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          from: "profiles", // Profile collection
          localField: "participants", // user IDs in conversation
          foreignField: "userId", // Profile.userId
          as: "participantProfiles",
        },
      },
      {
        $project: {
          participants: 1,
          lastMessage: 1,
          type: 1,
          name: 1,
          opportunityId: 1,
          unreadCounts: 1,
          updatedAt: 1,
          participantProfiles: {
            _id: 1,
            userId: 1,
            Name: 1,
            profilePicture: 1,
          },
        },
      },
    ]);

    res.json(conversations);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Get a single conversation with participant profiles
router.get("/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(conversationId) } },
      {
        $lookup: {
          from: "profiles",
          localField: "participants",
          foreignField: "userId",
          as: "participantProfiles",
        },
      },
      {
        $project: {
          participants: 1,
          lastMessage: 1,
          type: 1,
          name: 1,
          opportunityId: 1,
          unreadCounts: 1,
          updatedAt: 1,
          participantProfiles: {
            _id: 1,
            userId: 1,
            Name: 1,
            profilePicture: 1,
          },
        },
      },
    ]);

    if (!conversation || conversation.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 3. Get messages of a conversation
//----------------------------------------------------
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
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

    const User = require("../../models/user");
    const Profile = require("../../models/userProfile");
    const { sendNewMessageNotification } = require("../utils/pushNotificationService");
    const { activeUsers } = require("../socketHandler");

    const message = await Message.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      sender: new mongoose.Types.ObjectId(sender),
      text: text || "",
      media: media || null,
      delivered: [],
      readBy: [new mongoose.Types.ObjectId(sender)],
    });

    const conversation = await Conversation.findById(
      new mongoose.Types.ObjectId(conversationId)
    );

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

    // Get sender's profile to include Name field
    const senderProfile = await Profile.findOne({ userId: sender }).select('Name profilePicture');

    // Populate sender info from User model
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'phone avatar');

    // Create the message object with sender Name from Profile
    const messageWithProfile = {
      ...populatedMessage.toObject(),
      sender: {
        _id: populatedMessage.sender._id,
        Name: senderProfile?.Name || 'Unknown User',
        profilePicture: senderProfile?.profilePicture || null,
        phone: populatedMessage.sender.phone,
      }
    };

    // Emit Socket.IO event for real-time delivery
    const { getSocketInstance } = require('../socketHandler');
    const io = getSocketInstance();
    if (io) {
      io.to(conversationId).emit('new_message', {
        message: messageWithProfile,
        conversation: conversation,
      });
    }

    // Send push notifications to offline users
    const recipientIds = conversation.participants.filter(
      userId => String(userId) !== String(sender)
    );

    if (recipientIds.length > 0) {
      // Send push notifications asynchronously (don't await)
      sendNewMessageNotification(
        recipientIds,
        activeUsers,
        senderProfile?.Name || 'Someone',
        text || '📷 Photo',
        conversationId,
        message._id
      ).catch(err => console.error('Push notification error:', err));
    }

    res.json({ message: messageWithProfile, conversation });
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
        conversationId: new mongoose.Types.ObjectId(conversationId),
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $push: { readBy: new mongoose.Types.ObjectId(userId) } }
    );

    await Conversation.findByIdAndUpdate(
      new mongoose.Types.ObjectId(conversationId),
      {
        $set: { [`unreadCounts.${userId}`]: 0 },
      }
    );

    // Emit Socket.IO event for read receipts
    const { getSocketInstance } = require('../socketHandler');
    const io = getSocketInstance();
    if (io) {
      io.to(conversationId).emit('messages_read', {
        userId,
        conversationId,
      });
    }

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
    const { messageId } = req.params;
    const { conversationId } = req.query;

    await Message.findByIdAndDelete(new mongoose.Types.ObjectId(messageId));

    // Emit Socket.IO event for message deletion
    const { getSocketInstance } = require('../socketHandler');
    const io = getSocketInstance();
    if (io && conversationId) {
      io.to(conversationId).emit('message_deleted', {
        messageId,
        conversationId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 7. Delete entire conversation
//----------------------------------------------------
router.delete("/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.deleteMany({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    });
    await Conversation.findByIdAndDelete(new mongoose.Types.ObjectId(conversationId));

    res.json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 8. Create Group Chat for Opportunity
//----------------------------------------------------
router.post("/group", async (req, res) => {
  try {
    const { opportunityId, name, createdBy, initialParticipants } = req.body;

    if (!opportunityId || !name || !createdBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { createOpportunityChat } = require("../utils/groupChatHelper");

    const conversation = await createOpportunityChat(
      opportunityId,
      name,
      createdBy,
      initialParticipants || []
    );

    res.json(conversation);
  } catch (err) {
    console.error("Error:", err);
    if (err.message === 'Group chat already exists for this opportunity') {
      return res.status(409).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 9. Add Participant to Group Chat
//----------------------------------------------------
router.post("/group/:conversationId/add-participant", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const conversation = await Conversation.findById(
      new mongoose.Types.ObjectId(conversationId)
    );

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Not a group conversation" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if user is already a participant
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId
    );

    if (isParticipant) {
      return res.json({ message: "User already in group", conversation });
    }

    // Add user to participants
    conversation.participants.push(userObjectId);
    conversation.unreadCounts.set(userId, 0);
    await conversation.save();

    // Emit socket event
    const { getSocketInstance } = require('../socketHandler');
    const io = getSocketInstance();
    if (io) {
      io.to(conversationId).emit('participant_added', {
        conversationId,
        userId,
        participants: conversation.participants
      });
    }

    res.json(conversation);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 10. Remove Participant from Group Chat
//----------------------------------------------------
router.delete("/group/:conversationId/remove-participant", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const conversation = await Conversation.findById(
      new mongoose.Types.ObjectId(conversationId)
    );

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Not a group conversation" });
    }

    // Remove user from participants
    conversation.participants = conversation.participants.filter(
      p => p.toString() !== userId
    );
    conversation.unreadCounts.delete(userId);
    await conversation.save();

    // Emit socket event
    const { getSocketInstance } = require('../socketHandler');
    const io = getSocketInstance();
    if (io) {
      io.to(conversationId).emit('participant_removed', {
        conversationId,
        userId,
        participants: conversation.participants
      });
    }

    res.json(conversation);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 11. Get Group Chat for Opportunity
//----------------------------------------------------
router.get("/group/:opportunityId", async (req, res) => {
  try {
    const { opportunityId } = req.params;

    const conversation = await Conversation.aggregate([
      {
        $match: {
          opportunityId: new mongoose.Types.ObjectId(opportunityId),
          type: "group"
        }
      },
      {
        $lookup: {
          from: "profiles",
          localField: "participants",
          foreignField: "userId",
          as: "participantProfiles"
        }
      },
      {
        $lookup: {
          from: "opportunities",
          localField: "opportunityId",
          foreignField: "_id",
          as: "opportunity"
        }
      },
      {
        $project: {
          participants: 1,
          lastMessage: 1,
          type: 1,
          name: 1,
          opportunityId: 1,
          unreadCounts: 1,
          updatedAt: 1,
          participantProfiles: {
            _id: 1,
            userId: 1,
            Name: 1,
            profilePicture: 1
          },
          opportunity: { $arrayElemAt: ["$opportunity", 0] }
        }
      }
    ]);

    if (!conversation || conversation.length === 0) {
      return res.status(404).json({ message: "No group chat found for this opportunity" });
    }

    res.json(conversation[0]);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//----------------------------------------------------
// 12. Get Participants of a Group Chat
//----------------------------------------------------
router.get("/group/:conversationId/participants", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(conversationId) } },
      {
        $lookup: {
          from: "profiles",
          localField: "participants",
          foreignField: "userId",
          as: "participantProfiles"
        }
      },
      {
        $project: {
          participants: 1,
          participantProfiles: {
            _id: 1,
            userId: 1,
            Name: 1,
            profilePicture: 1,
            bio: 1
          }
        }
      }
    ]);

    if (!conversation || conversation.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation[0]);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;