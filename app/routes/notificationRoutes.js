const express = require("express");
const router = express.Router();
const { Expo } = require("expo-server-sdk");
const User = require("../../models/user");
const Notification = require("../../models/notification");
const { authMiddleware } = require("../../middleware/auth");

// Create an Expo SDK client
const expo = new Expo();

/**
 * @route POST /notification/save-token
 * @desc Save or update Expo push token for a user
 */
router.post("/save-token", async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: "userId and token are required" });
    }

    // Save or update the token
    const user = await User.findByIdAndUpdate(
      userId,
      { pushToken: token },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "Push token saved", user });
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * @route POST /notification/send
 * @desc Send a push notification to one user or all users
 */
router.post("/send", async (req, res) => {
  try {
    const { userId, title, body } = req.body;

    // Fetch users (one or all)
    let users;
    if (userId) {
      const user = await User.findById(userId);
      users = user ? [user] : [];
    } else {
      users = await User.find({ pushToken: { $exists: true, $ne: null } });
    }

    if (!users.length) {
      return res.status(404).json({ message: "No users found with push tokens" });
    }

    const messages = [];

    for (const user of users) {
      if (!Expo.isExpoPushToken(user.pushToken)) {
        console.warn(`Invalid Expo push token for user ${user._id}: ${user.pushToken}`);
        continue;
      }

      messages.push({
        to: user.pushToken,
        sound: "default",
        title: title || "Notification",
        body: body || "You have a new message",
        data: { userId: user._id },
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending chunk:", error);
      }
    }

    res.json({ success: true, message: "Notifications sent", tickets });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== ENHANCED NOTIFICATION SYSTEM ==========

/**
 * @route POST /notification
 * @desc Create a new notification
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { userId, type, title, message, link, metadata } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, type, title, and message are required"
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      metadata
    });

    res.status(201).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

/**
 * @route GET /notification
 * @desc Get all notifications for the authenticated user
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit, page, unreadOnly, type } = req.query;

    const query = { userId };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    if (type) {
      query.type = type;
    }

    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false })
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        total
      }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

/**
 * @route PATCH /notification/:notificationId/read
 * @desc Mark a specific notification as read
 */
router.patch("/:notificationId/read", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      notification
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

/**
 * @route PATCH /notification/read-all
 * @desc Mark all notifications as read for the authenticated user
 */
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

/**
 * @route DELETE /notification/:notificationId
 * @desc Delete a specific notification
 */
router.delete("/:notificationId", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification deleted"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;
