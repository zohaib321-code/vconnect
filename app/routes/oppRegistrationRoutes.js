// oppRegistrationRoutes.js
const express = require('express');
const router = express.Router();
const OppRegistration = require('../../models/oppRegistration');
const authMiddleware = require('../../middleware/auth');

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
router.get('/org/:orgId', authMiddleware, (req, res) => {
  const { orgId } = req.params;
  OppRegistration.find()
    .populate({
      path: 'opportunityId',
      match: { organization: orgId },
      populate: { path: 'organization' }
    })
    .populate('userId', 'name email')
    .then(results => {
      const apps = results
        .filter(r => r.opportunityId) 
        .map(r => ({
          _id: r._id,
          volunteer: {
            name: r.userId?.name || 'Unknown',
            email: r.userId?.email || '',
          },
          opportunity: r.opportunityId.title,
          appliedAt: r.createdAt,
          status: r.status,
          message: r.message || ''
        }));
      res.status(200).json(apps);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Error fetching applications' });
    });
});

module.exports = router;