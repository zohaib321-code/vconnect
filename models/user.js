const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const Schema= mongoose.Schema;

const userSchema= new Schema({
    name:{
        type:String,
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
    active:{
        type: String,
        required: true
    },
    type:{
        type: String,
        required: true
    }
}, {timestamps: true});

userSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports=User;