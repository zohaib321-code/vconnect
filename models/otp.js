const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: false,
    index: true,
  },
  email:{
    type:String,
     required: false,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Automatically delete OTP after 5 minutes (300 seconds)
  },
});

module.exports = mongoose.model('Otp', otpSchema);