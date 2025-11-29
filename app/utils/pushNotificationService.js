// pushNotificationService.js
const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a single user
 * @param {String} pushToken - Expo push token
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 * @returns {Promise<Object>} - Result of the push notification
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
    try {
        // Check that the push token is valid
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            return { success: false, error: 'Invalid push token' };
        }

        // Construct the message
        const message = {
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
        };

        // Send the notification
        const ticketChunk = await expo.sendPushNotificationsAsync([message]);
        console.log('Push notification sent:', ticketChunk);

        return { success: true, ticket: ticketChunk[0] };
    } catch (error) {
        console.error('Error sending push notification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send push notifications to multiple users
 * @param {Array} notifications - Array of notification objects with {pushToken, title, body, data, badge, categoryIdentifier, channelId, collapseId}
 * @returns {Promise<Array>} - Results of the push notifications
 */
async function sendBulkPushNotifications(notifications) {
    try {
        const messages = [];

        // Construct messages
        for (const notification of notifications) {
            const {
                pushToken,
                title,
                body,
                data = {},
                badge,
                categoryIdentifier,
                channelId,
                collapseId
            } = notification;

            // Check that the push token is valid
            if (!Expo.isExpoPushToken(pushToken)) {
                console.error(`Push token ${pushToken} is not a valid Expo push token`);
                continue;
            }

            const message = {
                to: pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: data,
                priority: 'high',
            };

            // Add optional fields if provided
            if (badge !== undefined) {
                message.badge = badge;
            }
            if (categoryIdentifier) {
                message.categoryIdentifier = categoryIdentifier;
            }
            if (channelId) {
                message.channelId = channelId;
            }
            if (collapseId) {
                message.collapseId = collapseId;
            }

            messages.push(message);
        }

        // The Expo push notification service accepts batches of notifications
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        // Send the chunks to the Expo push notification service
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending chunk:', error);
            }
        }

        return tickets;
    } catch (error) {
        console.error('Error sending bulk push notifications:', error);
        return [];
    }
}

/**
 * Send new message notification to offline users with grouping support
 * @param {Array} recipientUserIds - Array of user IDs who should receive notification
 * @param {Object} activeUsers - Map of currently active users
 * @param {String} senderName - Name of the message sender
 * @param {String} messageText - Text content of the message
 * @param {Object} conversationId - ID of the conversation
 * @param {Object} messageId - ID of the message
 */
async function sendNewMessageNotification(
    recipientUserIds,
    activeUsers,
    senderName,
    messageText,
    conversationId,
    messageId
) {
    try {
        const User = require('../../models/user');
        const Conversation = require('../../models/conversations');

        // Find offline users (not in activeUsers map)
        const offlineUserIds = recipientUserIds.filter(
            userId => !activeUsers.has(String(userId))
        );

        if (offlineUserIds.length === 0) {
            console.log('All recipients are online, no push notifications needed');
            return;
        }

        // Fetch push tokens for offline users
        const offlineUsers = await User.find({
            _id: { $in: offlineUserIds },
            pushToken: { $exists: true, $ne: null, $ne: '' }
        }).select('_id pushToken');

        if (offlineUsers.length === 0) {
            console.log('No offline users with valid push tokens');
            return;
        }

        // Get conversation details for grouping
        const conversation = await Conversation.findById(conversationId);

        // Prepare notifications with grouping and badge support
        const notifications = await Promise.all(offlineUsers.map(async (user) => {
            // Get unread count for badge
            const unreadCount = conversation?.unreadCounts?.get(String(user._id)) || 1;

            // Create notification with grouping
            return {
                pushToken: user.pushToken,
                title: `${senderName}`,
                body: messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText,
                data: {
                    type: 'new_message',
                    conversationId: String(conversationId),
                    messageId: String(messageId),
                    senderName: senderName,
                },
                badge: unreadCount,
                // Grouping configuration
                categoryIdentifier: 'message',
                channelId: 'chat-messages',
                // Group by conversation
                collapseId: String(conversationId),
            };
        }));

        // Send notifications
        console.log(`Sending push notifications to ${notifications.length} offline users`);
        const results = await sendBulkPushNotifications(notifications);

        return results;
    } catch (error) {
        console.error('Error in sendNewMessageNotification:', error);
    }
}

module.exports = {
    sendPushNotification,
    sendBulkPushNotifications,
    sendNewMessageNotification,
};
