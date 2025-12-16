const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reportSchema = new Schema({
    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedContent: {
        type: {
            type: String,
            enum: ['opportunity', 'user', 'review', 'post'],
            required: true
        },
        id: {
            type: Schema.Types.ObjectId,
            required: true
        },
        title: {
            type: String,
            required: false
        }
    },
    reason: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'dismissed'],
        default: 'pending',
        index: true
    },
    resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    resolution: {
        type: String,
        required: false
    },
    action: {
        type: String,
        enum: ['none', 'warning', 'suspend', 'ban', 'remove_content'],
        default: 'none'
    }
}, { timestamps: true });

// Indexes for efficient queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ 'reportedContent.type': 1, status: 1 });
reportSchema.index({ severity: 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
