const express = require('express');
const router = express.Router();

const OppRegistration = require('../../models/oppRegistration');
const UserProfile = require('../../models/userProfile');
const { authMiddleware } = require('../../middleware/auth');

// 🔐 apply auth globally
router.use(authMiddleware);

/* =========================================================
   POST: Register for an opportunity
   ========================================================= */
router.post('/', async (req, res) => {
  try {
    const { userId, opportunityId, status = "pending" } = req.body;

    const oppRegistration = await OppRegistration.create({
      opportunityId,
      userId,
      status
    });

    return res.status(201).json({
      message: "Registered successfully",
      oppRegistered: oppRegistration
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error registering",
      error: err
    });
  }
});

/* =========================================================
   POST: Check if already registered
   ========================================================= */
router.post('/check', async (req, res) => {
  try {
    const { userId, opportunityId } = req.body;

    const exists = await OppRegistration.exists({ userId, opportunityId });
    return res.status(200).json({ isRegistered: !!exists });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error checking registration" });
  }
});

/* =========================================================
   GET: Applications for organization opportunities
   ========================================================= */
router.get('/org/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;

    const registrations = await OppRegistration.find()
      .populate({
        path: 'opportunityId',
        select: 'title _id',
        populate: {
          path: 'userId', // org who created opportunity
          select: 'name email'
        }
      })
      .populate({
        path: 'userId', // volunteer
        select: 'name email'
      });

    const output = [];

    for (const r of registrations) {
      if (
        r.opportunityId &&
        r.opportunityId.userId &&
        r.opportunityId.userId._id.toString() === orgId
      ) {
        const profile = await UserProfile.findOne({ userId: r.userId._id });

        output.push({
          _id: r._id,
          volunteer: {
            userId: r.userId._id.toString(), // ✅ ALWAYS PRESENT
            name: profile?.Name || r.userId.name,
            email: r.userId.email,
            profilePicture: profile?.profilePicture || null,
            bio: profile?.bio || "",
            skills: profile?.skills || [],
            interests: profile?.interests || [],
            bloodGroup: profile?.bloodGroup || null,
            isBloodDonor: profile?.isBloodDonor || false
          },
          opportunityId: r.opportunityId._id,
          opportunity: r.opportunityId.title,
          appliedAt: r.createdAt,
          status: r.status
        });
      }
    }

    return res.status(200).json(output);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

/* =========================================================
   GET: Logged-in user's own registrations (JWT-based)
   ========================================================= */
router.get('/me', async (req, res) => {
  try {
    const { userId } = req.body;

    const registrations = await OppRegistration.find({ userId })
      .populate({
        path: 'opportunityId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    return res.status(200).json(registrations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error fetching registrations"
    });
  }
});

/* =========================================================
   GET: Get registrations by user ID (for saved opportunities)
   ========================================================= */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const registrations = await OppRegistration.find({ userId })
      .populate({
        path: 'opportunityId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });

    return res.status(200).json(registrations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error fetching registrations for user",
      error: err.message
    });
  }
});

/* =========================================================
   GET: User's own registrations
   ========================================================= */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.body;

    const registrations = await OppRegistration.find({ userId })
      .populate('opportunityId');

    return res.status(200).json(registrations);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching registrations" });
  }
});


/* =========================================================
   DELETE: Withdraw application
   ========================================================= */
router.delete('/', async (req, res) => {
  try {
    const { opportunityId, userId } = req.body;

    const result = await OppRegistration.findOneAndDelete({
      userId,
      opportunityId
    });

    if (!result) {
      return res.status(404).json({ message: 'No registration found' });
    }

    const { removeUserFromOpportunityChat } = require('../utils/groupChatHelper');
    await removeUserFromOpportunityChat(opportunityId, userId);

    return res.status(200).json({ message: 'Registration removed' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error deleting registration' });
  }
});

/* =========================================================
   PATCH: Update application status
   ========================================================= */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await OppRegistration.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('opportunityId')
      .populate('userId');

    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    const {
      addUserToOpportunityChat,
      removeUserFromOpportunityChat
    } = require('../utils/groupChatHelper');

    const { sendPushNotification } = require('../utils/pushNotificationService');

    const Profile = require('../../models/userProfile');

    if (status === "accepted") {
      const conversation = await addUserToOpportunityChat(
        updated.opportunityId._id.toString(),
        updated.userId._id.toString()
      );

      if (conversation) {
        const profile = await Profile.findOne({ userId: updated.userId._id });
        if (profile?.expoPushToken) {
          sendPushNotification(
            profile.expoPushToken,
            'Added to Group Chat',
            `You've been added to ${updated.opportunityId.title}`,
            { conversationId: conversation._id.toString() }
          );
        }
      }
    }

    if (status === "rejected") {
      await removeUserFromOpportunityChat(
        updated.opportunityId._id.toString(),
        updated.userId._id.toString()
      );
    }

    return res.status(200).json({
      message: `Application ${status}`,
      application: updated
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
