const express = require("express");
const router = express.Router();
const { Expo } = require("expo-server-sdk");
const User = require("../../models/user");

// Create an Expo SDK client
const expo = new Expo();

/**
 * @route POST /api/notifications/save-token
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
 * @route POST /api/notifications/send
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

module.exports = router;
