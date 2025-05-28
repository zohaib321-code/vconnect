// authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../../models/user');
const Otp = require('../../models/otp');
const nodemailer = require('nodemailer');

// POST route to request OTP
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || !phone.startsWith('3') || phone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let otpRecord = await Otp.findOne({ phone });

    if (otpRecord && otpRecord.createdAt < today) {
      otpRecord.attempts = 0;
      otpRecord.createdAt = new Date();
    }

    if (otpRecord && otpRecord.attempts >= 5) {
      return res.status(429).json({ error: 'Maximum 5 OTP requests reached for today' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    if (otpRecord) {
      otpRecord.otp = otp;
      otpRecord.attempts += 1;
      otpRecord.createdAt = new Date();
      await otpRecord.save();
    } else {
      otpRecord = new Otp({
        phone,
        otp,
        attempts: 1,
      });
      await otpRecord.save();
    }

    const success = await fetch(
      'https://api.veevotech.com/v3/sendsms',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash: process.env.SMS_API_KEY || '051e86b2b4f26affda547507812a16c4',
          receivernum: `+92${phone}`,
          sendernum: 'default',
          textmessage: `Your OTP is ${otp}`
        })
      }
    );

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.log('Error sending OTP:', error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST route to verify OTP and create user
router.post('/verify-otp', async (req, res) => {
  const { phone, otp, email, password, active = true, type = 'user' } = req.body;

  try {
    const otpRecord = await Otp.findOne({ phone, otp });
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const existingUser = await User.findOne({ $or: [{ phone }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this phone or email already exists' });
    }

    const user = new User({
      phone,
      email,
      password,
      active,
      type,
    });

    const result = await user.save();
    await Otp.deleteOne({ phone });

    res.status(200).json({
      message: 'Signup successful',
      user: result,
    });
  } catch (error) {
    console.error('Error verifying OTP or creating user:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// POST route for email-based authentication
router.post('/authWithMail', (req, res) => {
  const { email, password } = req.body;

  User.findOne({ email: email, password: password })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User authenticated successfully', userId: user._id, type: user.type });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// GET route for phone-based authentication
router.get('/authWithPhone', (req, res) => {
  const { phone } = req.body;

  User.findOne({ phone: phone })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User found', userId: user._id, type: user.type });
    }) 
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// POST route to check if email exists
router.post('/checkMail', (req, res) => {
  const { email } = req.body;

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User already exists' });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});
router.post('/organization/request-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let otpRecord = await Otp.findOne({ email });

    if (otpRecord && otpRecord.createdAt < today) {
      otpRecord.attempts = 0;
      otpRecord.createdAt = new Date();
    }

    if (otpRecord && otpRecord.attempts >= 5) {
      return res.status(429).json({ error: 'Maximum 5 OTP requests reached for today' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    if (otpRecord) {
      otpRecord.otp = otp;
      otpRecord.attempts += 1;
      otpRecord.createdAt = new Date();
      await otpRecord.save();
    } else {
      otpRecord = new Otp({
        email,
        otp,
        attempts: 1,
      });
      await otpRecord.save();
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'amitammi24@gmail.com',
        pass: 'zqfr nfma xuhd oour',
      },
    });

    await transporter.sendMail({
      from: 'amitammi24@gmail.com',
      to: email,
      subject: 'Organization Signup OTP',
      text: `Your OTP is: ${otp}`,
    });

    res.status(200).json({ message: 'OTP sent successfully to email' });
  } catch (error) {
    console.log('Error sending OTP:', error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST route to verify OTP and create organization user
router.post('/organization/verify-otp', async (req, res) => {
  const {name, email, otp, phone, password, active = true, type = 'organization' } = req.body;

  try {
    const otpRecord = await Otp.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const existingUser = await User.findOne({ $or: [{ phone }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this phone or email already exists' });
    }

    const user = new User({
      name,
      phone,
      email,
      password,
      active,
      type,
    });

    const result = await user.save();
    await Otp.deleteOne({ email });

    res.status(200).json({
      message: 'Organization signup successful',
      user: result,
    });
  } catch (error) {
    console.error('Error verifying OTP or creating organization:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// POST route to check if phone exists
router.post('/checkPhone', (req, res) => {
  const { phone } = req.body;

  User.findOne({ phone: phone })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User already exists', userId: user._id });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

module.exports = router;