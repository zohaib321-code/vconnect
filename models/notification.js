const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'match',
            'application',
            'message',
            'reminder',
            'system',
            'feedback',
            'opportunity_update',
            'volunteer_joined',
            'opportunity_started',
            'opportunity_completed'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: false
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        required: false
    }
}, { timestamps: true });

// Compound index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
