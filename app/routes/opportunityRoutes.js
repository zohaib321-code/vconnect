// opportunityRoutes.js
const express = require('express');
const router = express.Router();
const Opportunity = require('../../models/opportunity');
const UserProfile = require('../../models/userProfile');
const OrgProfile = require('../../models/orgProfile')
// POST route to create an opportunity
router.post('/', (req, res) => {
  const {
    userId,
    postMedia,
    title,
    description,
    purpose,
    role,
    additional_details,
    location,
    skillsRequired,
    opportunityType,
    dateTime,
    tags
  } = req.body;

  const opportunity = new Opportunity({
    userId,
    postMedia,
    title,
    description,
    purpose,
    role,
    additional_details,
    location: {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
      address: location.address
    },
    skillsRequired,
    opportunityType,
    dateTime,
    tags
  });

  opportunity.save()
    .then((result) => {
      res.status(200).json({
        message: "Opportunity created successfully",
        opportunity: result
      });
    })
    .catch((err) => {
      res.status(500).json({
        message: "Error saving opportunity",
        error: err
      });
    });
});

// GET route to fetch all opportunities
router.get('/', (req, res) => {
  Opportunity.find()
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching opportunities');
    });
});

// GET route to fetch an opportunity by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  Opportunity.findById(id)
    .then((result) => {
      if (!result) {
        return res.status(404).send('Opportunity not found');
      }
      res.send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching opportunity');
    });
});

// POST route to search opportunities

router.post('/search', async (req, res) => {
  const { coordinates, distance, daysOfWeek, userId } = req.body || {};

  let query = {};

  if (coordinates && coordinates.latitude && coordinates.longitude && distance) {
    const radiusInRadians = parseFloat(distance) / 6378137;
    query.location = {
      $geoWithin: {
        $centerSphere: [
          [coordinates.longitude, coordinates.latitude],
          radiusInRadians
        ]
      }
    };
  }

  if (userId) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (userProfile?.interests?.length > 0) {
        query.tags = { $in: userProfile.interests };
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return res.status(500).json({ message: 'Error fetching user profile', error: err });
    }
  }

  try {
    let opportunities = await Opportunity.find(query)
      .lean(); // returns plain JS objects for easier manipulation

    // Filter by day of week
    if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      opportunities = opportunities.filter(op =>
        op.dateTime.some(slot => daysOfWeek.includes(new Date(slot.date).getDay()))
      );
    }

    // Fetch org details for each opportunity
    const orgProfiles = await OrgProfile.find({
      userId: { $in: opportunities.map(op => op.userId) }
    }).select('userId orgName profilePicture');

    const orgMap = {};
    orgProfiles.forEach(org => {
      orgMap[org.userId.toString()] = {
        orgId: org.userId,
        orgName: org.orgName,
        profilePicture: org.profilePicture
      };
    });

    // Attach org details to each opportunity
    opportunities = opportunities.map(op => ({
      ...op,
      organization: orgMap[op.userId.toString()] || null
    }));

    res.status(200).json(opportunities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching opportunities', error: err });
  }
});


module.exports = router;