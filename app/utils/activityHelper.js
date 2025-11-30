// activityHelper.js
// Helper functions to create activities for organization dashboard

const Activity = require('../../models/activity');

/**
 * Create an activity record
 * @param {Object} activityData - Activity data
 * @param {String} activityData.organizationId - Organization user ID
 * @param {String} activityData.type - Activity type
 * @param {String} activityData.description - Activity description
 * @param {String} activityData.userId - Optional user ID involved
 * @param {String} activityData.opportunityId - Optional opportunity ID
 * @param {String} activityData.conversationId - Optional conversation ID
 * @param {Object} activityData.metadata - Optional metadata
 */
async function createActivity(activityData) {
    try {
        await Activity.create(activityData);
    } catch (error) {
        console.error('Error creating activity:', error);
        // Don't throw - activity tracking shouldn't break main functionality
    }
}

/**
 * Create activity for opportunity creation
 */
async function logOpportunityCreated(organizationId, opportunityId, title) {
    await createActivity({
        organizationId,
        type: 'opportunity_created',
        description: `New opportunity "${title}" created`,
        opportunityId
    });
}

/**
 * Create activity for opportunity completion
 */
async function logOpportunityCompleted(organizationId, opportunityId, title) {
    await createActivity({
        organizationId,
        type: 'opportunity_complete',
        description: `Opportunity "${title}" marked as complete`,
        opportunityId
    });
}

/**
 * Create activity for volunteer signup/application
 */
async function logVolunteerSignup(organizationId, userId, opportunityId, userName, opportunityTitle) {
    await createActivity({
        organizationId,
        type: 'volunteer_signup',
        description: `${userName} signed up for ${opportunityTitle}`,
        userId,
        opportunityId
    });
}

/**
 * Create activity for volunteer application
 */
async function logVolunteerApplication(organizationId, userId, opportunityId, userName, opportunityTitle) {
    await createActivity({
        organizationId,
        type: 'application',
        description: `New application from ${userName} for ${opportunityTitle}`,
        userId,
        opportunityId
    });
}

/**
 * Create activity for new message
 */
async function logNewMessage(organizationId, userId, conversationId, userName) {
    await createActivity({
        organizationId,
        type: 'message',
        description: `New message from volunteer ${userName}`,
        userId,
        conversationId
    });
}

module.exports = {
    createActivity,
    logOpportunityCreated,
    logOpportunityCompleted,
    logVolunteerSignup,
    logVolunteerApplication,
    logNewMessage
};
