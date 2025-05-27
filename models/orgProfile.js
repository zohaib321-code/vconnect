const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const org_profileSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, // ObjectId to reference the User model
        ref: 'User', // Reference to the 'User' model
        required: true
    },
    rgName: {
        type: String,
        required: false
    },
    aboutOrg: {
        type: String,
        required: false
    },
    publicPhone:{
        type: String,
        required: false
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: false
        },
        physicalAddress: {
            type: String,
            required: false
        }
    },
    profilePicture: {
        type: String, // URL to the profile picture
        required: false
    },
    coverPicture: {
        type: String, // URL to the profile picture
        required: false
    },
    
    interests: {
        type: [String], // Array of causes (strings)
        required: false
    },
    isVerified: {
        type: Boolean, // A flag to indicate whether the Organization is Verified
        required: false,
        default: false // Default to false if not specified
    },
    
}, {timestamps: true});

const OrgProfile = mongoose.model('OrganizationProfile', org_profileSchema);

module.exports = OrgProfile;
