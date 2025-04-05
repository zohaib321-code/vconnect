const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const UserProfile = require('../models/userProfile');  // Import the UserProfile model
const User = require('../models/user');  // Assuming you have a User model
const Opportunity = require('../models/opportunity');  // Assuming you have an Opportunity model
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
    _id: userId,  // Set _id to the same as the userId
    Name, bio, profilePicture, skills, interests, isBloodDonor, bloodGroup
  });

  userProfile.save()
    .then((result) => {
      res.status(201).json({
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

// GET route to fetch a user profile by userId
app.get('/userProfile/:userId', (req, res) => {
  const { userId } = req.params;

  UserProfile.findOne({ _id: userId }) // Querying using _id instead of userId
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
    { _id: userId }, // Use _id to find and update
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

  UserProfile.findOneAndDelete({ _id: userId }) // Use _id to find and delete
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
      res.status(201).json({
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
    userId, postMedia, title, description, purpose, role, additional_details,
    location, skillsRequired, opportunityType, dateTime
  } = req.body;

  const opportunity = new Opportunity({
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
    dateTime
  });

  opportunity.save()
    .then((result) => {
      res.status(201).json({
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


app.get('/authWithMail', (req, res) => {
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
  User.findOne({phone: phone})
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
      res.status(200).json({ message: 'User already exists'});
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

app.post('/checkPhone', (req, res) => {
  const { phone } = req.body;

  // Find the user by email and password
  User.findOne({ phone: phone })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Only send the _id in the response
      res.status(200).json({ message: 'User already exists'});
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});
