const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const oppRegistrationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    opportunityId:{
        type: Schema.Types.ObjectId, 
        ref: 'Opportunity',
        required: true
    },
    status:{
        type: String, 
        required: true
    }
},{timestamps: true});

const OppRegistration = mongoose.model('OppRegistration', oppRegistrationSchema);

module.exports = OppRegistration;
