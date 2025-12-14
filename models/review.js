const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    reviewerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    revieweeId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    opportunityId: {
        type: Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: false
    },
    type: {
        type: String,
        enum: ['userToOrg', 'orgToUser'],
        required: true
    }
}, { timestamps: true });

// Prevent duplicate reviews for the same opportunity context
reviewSchema.index({ reviewerId: 1, revieweeId: 1, opportunityId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
