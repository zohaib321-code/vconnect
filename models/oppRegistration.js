const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const oppRegistrationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    opportunityId: {
        type: Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: true
    },
    status: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Indexes for performance and data integrity
oppRegistrationSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });
oppRegistrationSchema.index({ userId: 1, status: 1 });

const OppRegistration = mongoose.model('OppRegistration', oppRegistrationSchema);

module.exports = OppRegistration;
