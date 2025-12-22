const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const opportunitySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postMedia: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    additional_details: {
        type: String,
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number],
            required: false
        },
        address: {
            type: String,
            required: false
        }
    },
    skillsRequired: {
        type: [String],
        required: false
    },
    opportunityType: {
        type: String,
        enum: ['InPerson', 'Virtual'],
        required: true
    },
    tags: {
        type: [String],
        required: false
    },
    dateTime: [{
        date: {
            type: Date,
            required: true
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        }
    }]
}, { timestamps: true });

// Add status and moderation fields
opportunitySchema.add({
    status: {
        type: String,
        enum: ['pending', 'upcoming', 'started', 'ended', 'cancelled', 'rejected'],
        default: 'pending'
    },
    flagged: {
        type: Boolean,
        default: false
    },
    flagReason: {
        type: String,
        required: false
    },
    applicantCount: {
        type: Number,
        default: 0
    }
});

// Geospatial index
opportunitySchema.index({ location: '2dsphere' });

// Performance indexes
opportunitySchema.index({ status: 1, 'dateTime.date': 1 });
opportunitySchema.index({ userId: 1 }); // For org's opportunities

const Opportunity = mongoose.model('Opportunity', opportunitySchema);

module.exports = Opportunity;
