// oppRegistrationRoutes.js
const express = require('express');
const router = express.Router();
const OppRegistration = require('../../models/oppRegistration');
const {authMiddleware} = require('../../middleware/auth');

router.use(authMiddleware);
// POST route for adding opportunity registration
router.post('/',authMiddleware, (req, res) => {
  const { opportunityId , status } = req.body;
  const userId = req.user.userId;
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
  if( userId !==req.user.userId){
    return res.status(403).send('Unauthorized')
  }
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
  const { opportunityId } = req.body;
  const userId = req.user.userId;
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
  const { opportunityId } = req.body;
  const userId = req.user.userId;
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

module.exports = router;