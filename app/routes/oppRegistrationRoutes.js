// oppRegistrationRoutes.js
const express = require('express');
const router = express.Router();
const OppRegistration = require('../../models/oppRegistration');
const {authMiddleware} = require('../../middleware/auth');
const UserProfile = require('../../models/userProfile');

router.use(authMiddleware);
// POST route for adding opportunity registration
router.post('/',authMiddleware, (req, res) => {
  const { opportunityId, userId, status } = req.body;
  const oppRegistration = new OppRegistration({
    opportunityId,
    userId,
    status
  });

  oppRegistration.save()
    .then((result) => {
      res.status(200).json({
        message: "DTV Registered",
        oppRegistered: result
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Error Registering DTV",
        error: err
      });
    });
});

// GET route to fetch all opportunity registrations for a user
router.get('/:userId',authMiddleware, (req, res) => {
  const { userId } = req.params;
  OppRegistration.find({ userId: userId })
    .populate('opportunityId')
    .then((result) => {
      if (!result) {
        return res.status(404).send('No Registrations found');
      }
      res.status(200).json(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching registered opportunities');
    });
});

// DELETE route to remove a specific registration
router.delete('/',authMiddleware, (req, res) => {
  const { userId, opportunityId } = req.body;

  OppRegistration.findOneAndDelete({ userId, opportunityId })
    .then(result => {
      if (!result) {
        return res.status(404).json({ message: 'No registration found to delete' });
      }
      res.status(200).json({ message: 'Registration deleted successfully' });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        message: 'Error deleting registration',
        error: err
      });
    });
});

// POST route to check if a registration exists
router.post('/check',authMiddleware, (req, res) => {
  const { userId, opportunityId } = req.body;

  OppRegistration.exists({ userId, opportunityId })
    .then(result => {
      res.status(200).json({ isRegistered: !!result });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        message: 'Error checking registration',
        error: err
      });
    });
});

// GET route to fetch all applications for organization's opportunities
router.get('/org/:orgId', authMiddleware, async (req, res) => {
  try {
    const { orgId } = req.params;

    // Step 1: Get all registrations where the opportunity belongs to this org
    const registrations = await OppRegistration.find()
      .populate({
        path: "opportunityId",
        populate: {
          path: "userId", // org who created the opportunity
          select: "name email"
        }
      })
      .populate({
        path: "userId", // volunteer who applied
        select: "name email"
      });

    const output = [];

    for (const r of registrations) {
      if (
        r.opportunityId &&
        r.opportunityId.userId &&
        r.opportunityId.userId._id.toString() === orgId
      ) {
        // Fetch volunteer profile
        const profile = await UserProfile.findOne({
          userId: r.userId._id
        });

        output.push({
          _id: r._id,
          volunteer: {
            name: profile?.Name || r.userId?.name || "Unknown",
            email: r.userId?.email || "",
            profilePicture: profile?.profilePicture || null,
            bio: profile?.bio || "",
            skills: profile?.skills || [],
            interests: profile?.interests || [],
            bloodGroup: profile?.bloodGroup || null,
            isBloodDonor: profile?.isBloodDonor || false
          },
          opportunity: r.opportunityId?.title || "",
          appliedAt: r.createdAt,
          status: r.status,
        });
      }
    }

    return res.status(200).json(output);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// PATCH route to update application status (accept/reject)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate input
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await OppRegistration.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.status(200).json({
      message: `Application ${status} successfully`,
      application: updated,
    });

  } catch (err) {
    console.error("Error updating application status:", err);
    return res.status(500).json({
      message: "Server error while updating status",
      error: err,
    });
  }
});



module.exports = router;