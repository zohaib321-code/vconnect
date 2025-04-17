const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const oppRegistrationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, // ObjectId to reference the User model
        ref: 'User', // Reference to the 'User' model (poster)
        required: true
    },
    opportunityId:{
        type: Schema.Types.ObjectId, // ObjectId to reference the User model
        ref: 'Opportunity',
        required: true
    },
    status:{
        type: String, // ObjectId to reference the User model
        required: true
    }
},{timestamps: true});

const OppRegistration = mongoose.model('OppRegistration', oppRegistrationSchema);

module.exports = OppRegistration;
