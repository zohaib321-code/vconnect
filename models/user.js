const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: false,
    },
    phone: {
        type: Number,
        unique: true,
        required: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: false
    },
    active: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    pushToken: {
        type: String,
    },
    averageRating: {
        type: Number,
        default: 0
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'suspended'],
        default: 'active'
    },
    suspendedReason: {
        type: String,
        required: false
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    completedOpportunities: {
        type: Number,
        default: 0
    },
    totalHours: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const UserString = 'User';

// Virtual for UserProfile
userSchema.virtual('profile', {
    ref: 'Profile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

// Virtual for OrganizationProfile
userSchema.virtual('organizationProfile', {
    ref: 'OrganizationProfile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

// Ensure virtuals are included
userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;