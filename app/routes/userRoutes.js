// userRoutes.js
const express = require('express');
const router = express.Router();
const UserProfile = require('../../models/userProfile');
const User = require('../../models/user');

// POST route to create a user profile
router.post('/userProfile', (req, res) => {
  const {
    userId, Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
  } = req.body;

  const userProfile = new UserProfile({
    userId,
    Name,
    bio,
    profilePicture,
    skills,
    interests,
    isBloodDonor,
    bloodGroup
  });

  userProfile.save()
    .then((result) => {
      res.status(200).json({
        message: "User profile created successfully",
        userProfile: result
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Error saving user profile",
        error: err
      });
    });
});

// GET route to fetch all user profiles
router.get('/userProfile', (req, res) => {
  UserProfile.find()
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching user profiles');
    });
});

// GET route to fetch a user profile by userId
router.get('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;

  UserProfile.findOne({ userId: userId })
    .then((result) => {
      if (!result) {
        return res.status(404).send('User profile not found');
      }
      res.status(200).json(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching user profile');
    });
});

// PUT route to update a user profile
router.put('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;
  const {
    Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
  } = req.body;

  UserProfile.findOneAndUpdate(
    { userId: userId },
    { Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup },
    { new: true }
  )
    .then((result) => {
      if (!result) {
        return res.status(404).send('User profile not found');
      }
      res.status(200).json({
        message: 'User profile updated successfully',
        userProfile: result
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error updating user profile');
    });
});

// DELETE route to remove a user profile
router.delete('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;

  UserProfile.findOneAndDelete({ userId: userId })
    .then((result) => {
      if (!result) {
        return res.status(404).send('User profile not found');
      }
      res.status(200).json({
        message: 'User profile deleted successfully',
        userProfile: result
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error deleting user profile');
    });
});

// POST route to create a user
router.post('/user', (req, res) => {
  const { phone, email, password, active, type } = req.body;

  const user = new User({
    phone,
    email,
    password,
    active,
    type
  });

  user.save()
    .then((result) => {
      res.status(200).json({
        message: "User created successfully",
        user: result
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Error saving user",
        error: err
      });
    });
});

// GET route to fetch all users
router.get('/user', (req, res) => {
  User.find()
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching users');
    });
});

// GET route to fetch a user by ID
router.get('/user/:id', (req, res) => {
  const { id } = req.params;
  User.findById(id)
    .then((result) => {
      if (!result) {
        return res.status(404).send('User not found');
      }
      res.send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching user');
    });
});

// DELETE route to remove a user by ID
router.delete('/user/:id', (req, res) => {
  const { id } = req.params;
  User.findByIdAndDelete(id)
    .then((result) => {
      if (!result) {
        return res.status(404).send('User not found');
      }
      res.send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error deleting user');
    });
});

module.exports = router;