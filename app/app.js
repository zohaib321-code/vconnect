const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const UserProfile = require('../models/userProfile');  // Import the UserProfile model
const User = require('../models/user');  // Assuming you have a User model
const Opportunity = require('../models/opportunity');  // Assuming you have an Opportunity model
const OppRegistration = require('../models/oppRegistration');
const Otp = require('../models/otp');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());  // Middleware to parse incoming JSON data

// Connect to MongoDB
const dburi = "mongodb+srv://vcon_user:vcon_pass@vconnect.8ot7y.mongodb.net/vConnect?retryWrites=true&w=majority&appName=vConnect";
mongoose.connect(dburi, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server is now running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

// Logger middleware
app.use((req, res, next) => {
  console.log('New request made:');
  console.log('Host: ', req.hostname);
  console.log('Path: ', req.path);
  console.log('Method: ', req.method);
  next();
});

// Test route
app.get('/', (req, res) => {
  res.send("Welcome to the backend!");
});

// POST route to create a new user profile
app.post('/userProfile', (req, res) => {
  const {
    userId, Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
  } = req.body; // Extract data from request body

  const userProfile = new UserProfile({
    userId: userId,  // Set _id to the same as the userId
    Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
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
app.get('/userProfile', (req, res) => {
  UserProfile.find()
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching user profiles');
    });
});
app.post('/api/request-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || !phone.startsWith('3') || phone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  try {
    // Get current date (midnight) for daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let otpRecord = await Otp.findOne({ phone });

    // Reset attempts if last attempt was before today
    if (otpRecord && otpRecord.createdAt < today) {
      otpRecord.attempts = 0;
      otpRecord.createdAt = new Date();
    }

    // Check OTP attempt limit (5 per day)
    if (otpRecord && otpRecord.attempts >= 5) {
      return res.status(429).json({ error: 'Maximum 5 OTP requests reached for today' });
    }

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update or create OTP record
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

    // Send OTP via SMS
    const success = await fetch(
      'https://api.veevotech.com/v3/sendsms',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body:{
          hash: process.env.SMS_API_KEY || '051e86b2b4f26affda547507812a16c4',
          receivernum: `+92${phone}`,
          sendernum: 'default',
          textmessage: `Your OTP is ${otp}`
        }
      }
    );

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.log('Error sending OTP:', error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
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

// GET route to fetch a user profile by userId
app.get('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;

  UserProfile.findOne({ userId: userId }) // Querying using _id instead of userId
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

// PUT route to update an existing user profile
app.put('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;
  const {
    Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
  } = req.body;

  UserProfile.findOneAndUpdate(
    { userId: userId }, // Use _id to find and update
    { Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup },
    { new: true } // Return the updated document
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

// DELETE route to remove a user profile by userId
app.delete('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;

  UserProfile.findOneAndDelete({ userId: userId }) // Use _id to find and delete
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
app.post('/user', (req, res) => {
  const { phone, email, password, active, type } = req.body;  // Extract data from request body

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
app.get('/user', (req, res) => {
  User.find()
    .then((result) => {
      res.send(result)
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching users');
    });
});

// GET route to fetch a user by ID
app.get('/user/:id', (req, res) => {
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
app.delete('/user/:id', (req, res) => {
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

// POST route to create an opportunity
app.post('/opportunity', (req, res) => {
  const {
    userId,
    postMedia,
    title,
    description,
    purpose,
    role,
    additional_details,
    location, // expects { latitude, longitude, address }
    skillsRequired,
    opportunityType,
    dateTime,
    tags // new field
  } = req.body;
console.log(req.body);
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
app.get('/opportunity', (req, res) => {
  Opportunity.find()
    .then((result) => {
      res.send(result)
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('Error fetching opportunities');
    });
});

app.post('/opportunity/search', async (req, res) => {
  const { coordinates, distance, daysOfWeek, userId } = req.body;

  let query = {};

  // Location filtering
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

  // Fetch user's interests from profile
  if (userId) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (userProfile && Array.isArray(userProfile.interests) && userProfile.interests.length > 0) {
        query.tags = { $in: userProfile.interests };
      }
      // If no interests, just skip the tags filter
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return res.status(500).json({ message: 'Error fetching user profile', error: err });
    }
  }

  try {
    let opportunities = await Opportunity.find(query);

    // Filter by day of week if provided
    if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      opportunities = opportunities.filter(op =>
        op.dateTime.some(slot => daysOfWeek.includes(new Date(slot.date).getDay()))
      );
    }

    res.status(200).json(opportunities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching opportunities', error: err });
  }
})



// GET route to fetch an opportunity by ID
app.get('/opportunity/:id', (req, res) => {
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


app.post('/authWithMail', (req, res) => {
  const { email, password } = req.body;

  // Find the user by email and password
  User.findOne({ email: email, password: password })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Only send the _id in the response
      res.status(200).json({ message: 'User authenticated successfully', userId: user._id });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

app.get('/authWithPhone', (req, res) => {
  const { phone } = req.body;

  // Find the user by email and password
  User.findOne({ phone: phone })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Only send the _id in the response
      res.status(200).json({ message: 'User found', userId: user._id });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

app.post('/checkMail', (req, res) => {
  const { email } = req.body;

  // Find the user by email and password
  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Only send the _id in the response
      res.status(200).json({ message: 'User already exists' });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

app.post('/checkPhone', (req, res) => {
  const { phone } = req.body;

  User.findOne({ phone: phone })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Only send the _id in the response
      res.status(200).json({ message: 'User already exists', userId: user._id });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

//Route for adding opportunity registration
app.post('/oppRegistration', (req,res) => {
  const { opportunityId, userId, status } = req.body;
  const oppRegistration = new OppRegistration({
    opportunityId: opportunityId,
    userId: userId,
    status: status
  })
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
        message: "Error Registring DTV",
        error: err
      });
    });
})

//Route for getting all opp registrations for 1 user
app.get('/oppRegistration/:userId', (req,res) => {
  const{userId}= req.params;
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
})

// Route for deleting a specific registration using _id
app.delete('/oppRegistration', (req, res) => {
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


// Route for finding a registration with user and postid
app.post('/oppRegistration/check', (req, res) => {
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
