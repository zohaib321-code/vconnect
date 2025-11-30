// groupChatHelper.js
const mongoose = require('mongoose');
const Conversation = require('../../models/conversations');
const { getSocketInstance } = require('../socketHandler');

/**
 * Get the group chat for a specific opportunity
 * @param {String} opportunityId - The opportunity ID
 * @returns {Promise<Object|null>} The conversation object or null
 */
async function getOpportunityChat(opportunityId) {
    try {
        const conversation = await Conversation.findOne({
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            type: 'group'
        });
        return conversation;
    } catch (err) {
        console.error('Error fetching opportunity chat:', err);
        throw err;
    }
}

/**
 * Create a new group chat for an opportunity
 * @param {String} opportunityId - The opportunity ID
 * @param {String} name - The group chat name
 * @param {String} createdBy - User ID of creator
 * @param {Array<String>} initialParticipants - Array of user IDs
 * @returns {Promise<Object>} The created conversation
 */
async function createOpportunityChat(opportunityId, name, createdBy, initialParticipants = []) {
    try {
        // Check if chat already exists
        const existing = await getOpportunityChat(opportunityId);
        if (existing) {
            throw new Error('Group chat already exists for this opportunity');
        }

        // Ensure creator is in participants
        const participantIds = [...new Set([createdBy, ...initialParticipants])];

        // Initialize unread counts
        const unreadCounts = {};
        participantIds.forEach(userId => {
            unreadCounts[userId] = 0;
        });

        const conversation = await Conversation.create({
            participants: participantIds.map(id => new mongoose.Types.ObjectId(id)),
            type: 'group',
            name,
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            unreadCounts
        });

        return conversation;
    } catch (err) {
        console.error('Error creating opportunity chat:', err);
        throw err;
    }
}

/**
 * Add a user to an opportunity's group chat
 * @param {String} opportunityId - The opportunity ID
 * @param {String} userId - The user ID to add
 * @returns {Promise<Object|null>} Updated conversation or null if no chat exists
 */
async function addUserToOpportunityChat(opportunityId, userId) {
    try {
        const conversation = await getOpportunityChat(opportunityId);

        if (!conversation) {
            console.log(`No group chat found for opportunity ${opportunityId}`);
            return null;
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Check if user is already a participant
        const isParticipant = conversation.participants.some(
            p => p.toString() === userId
        );

        if (isParticipant) {
            console.log(`User ${userId} is already in the group chat`);
            return conversation;
        }

        // Add user to participants
        conversation.participants.push(userObjectId);
        conversation.unreadCounts.set(userId, 0);

        await conversation.save();

        // Emit socket event for real-time update
        const io = getSocketInstance();
        if (io) {
            io.to(conversation._id.toString()).emit('participant_added', {
                conversationId: conversation._id,
                userId,
                participants: conversation.participants
            });
        }

        return conversation;
    } catch (err) {
        console.error('Error adding user to opportunity chat:', err);
        throw err;
    }
}

/**
 * Remove a user from an opportunity's group chat
 * @param {String} opportunityId - The opportunity ID
 * @param {String} userId - The user ID to remove
 * @returns {Promise<Object|null>} Updated conversation or null if no chat exists
 */
async function removeUserFromOpportunityChat(opportunityId, userId) {
    try {
        const conversation = await getOpportunityChat(opportunityId);

        if (!conversation) {
            console.log(`No group chat found for opportunity ${opportunityId}`);
            return null;
        }

        // Remove user from participants
        conversation.participants = conversation.participants.filter(
            p => p.toString() !== userId
        );

        // Remove unread count
        conversation.unreadCounts.delete(userId);

        await conversation.save();

        // Emit socket event for real-time update
        const io = getSocketInstance();
        if (io) {
            io.to(conversation._id.toString()).emit('participant_removed', {
                conversationId: conversation._id,
                userId,
                participants: conversation.participants
            });
        }

        return conversation;
    } catch (err) {
        console.error('Error removing user from opportunity chat:', err);
        throw err;
    }
}

module.exports = {
    getOpportunityChat,
    createOpportunityChat,
    addUserToOpportunityChat,
    removeUserFromOpportunityChat
};
