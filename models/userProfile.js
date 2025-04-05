const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const user_profileSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, // ObjectId to reference the User model
        ref: 'User', // Reference to the 'User' model
        required: true
    },
    Name: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        required: false
    },
    profilePicture: {
        type: String, // URL to the profile picture
        required: false
    },
    skills: {
        type: [String], // Array of skills (strings)
        required: false
    },
    interests: {
        type: [String], // Array of interests (strings)
        required: false
    },
    isBloodDonor: {
        type: Boolean, // A flag to indicate whether the user is a blood donor
        required: false,
        default: false // Default to false if not specified
    },
    bloodGroup: {
        type: String, // Blood group (e.g., "A+", "O-", "B+")
        required: false,
        enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], // Enum validation for blood group
        default: null // Default to null if not provided
    }
}, {timestamps: true});

const UserProfile = mongoose.model('Profile', user_profileSchema);

module.exports = UserProfile;
