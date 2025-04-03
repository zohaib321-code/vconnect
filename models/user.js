const mongoose = require('mongoose');

const Schema= mongoose.Schema;

const userSchema= new Schema({
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
    active:{
        type: String,
        required: true
    },
    type:{
        type: String,
        required: true
    }
}, {timestamps: true});

const User = mongoose.model('User', userSchema);

module.exports=User;