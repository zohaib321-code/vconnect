const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const activitySchema = new Schema({
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['volunteer_signup', 'message', 'opportunity_complete', 'application', 'opportunity_created'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    opportunityId: {
        type: Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: false
    },
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: false
    },
    metadata: {
        type: Schema.Types.Mixed,
        required: false
    }
}, { timestamps: true });

// Index for faster queries
activitySchema.index({ organizationId: 1, createdAt: -1 });
activitySchema.index({ type: 1 });

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
