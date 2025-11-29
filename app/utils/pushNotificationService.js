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
 * @param {Array} notifications - Array of notification objects with {pushToken, title, body, data}
 * @returns {Promise<Array>} - Results of the push notifications
 */
async function sendBulkPushNotifications(notifications) {
    try {
        const messages = [];

        // Construct messages
        for (const notification of notifications) {
            const { pushToken, title, body, data = {} } = notification;

            // Check that the push token is valid
            if (!Expo.isExpoPushToken(pushToken)) {
                console.error(`Push token ${pushToken} is not a valid Expo push token`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: data,
                priority: 'high',
            });
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
 * Send new message notification to offline users
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

        // Prepare notifications
        const notifications = offlineUsers.map(user => ({
            pushToken: user.pushToken,
            title: `New message from ${senderName}`,
            body: messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText,
            data: {
                type: 'new_message',
                conversationId: String(conversationId),
                messageId: String(messageId),
                senderId: String(recipientUserIds[0]), // The sender's ID
            }
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
