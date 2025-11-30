const express = require('express');
const router = express.Router();
const OrgProfile = require('../../models/orgProfile');
const {authMiddleware} = require('../../middleware/auth');

// Create org profile
router.post('/', async (req, res) => {

    const newProfile = new OrgProfile(req.body);
    newProfile.save()
    .then((result) => {
      res.status(200).json({
        message: "Org profile created successfully",
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

// Get all organization profiles
router.get('/',authMiddleware, async (req, res) => {
    try {
      const orgProfiles = await OrgProfile.find();
      res.status(200).json(orgProfiles);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
// Get org profile by userId
router.get('/:userId',authMiddleware, async (req, res) => {
  try {
    const profile = await OrgProfile.findOne({ userId: req.params.userId });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update org profile by userId
router.put('/:userId',authMiddleware, async (req, res) => {
  try {
    const updatedProfile = await OrgProfile.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedProfile) return res.status(404).json({ message: 'Profile not found' });
    res.json(updatedProfile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete org profile by userId
router.delete('/:userId',authMiddleware, async (req, res) => {
  try {
    const deleted = await OrgProfile.findOneAndDelete({ userId: req.params.userId });
    if (!deleted) return res.status(404).json({ message: 'Profile not found' });
    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
