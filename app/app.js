const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const cors = require('cors');  // Import CORS middleware

const User = require('../models/user');
const Opportunity = require('../models/opportunity');

// Connect to MongoDB
const dburi = "mongodb+srv://vcon_user:vcon_pass@vconnect.8ot7y.mongodb.net/vConnect?retryWrites=true&w=majority&appName=vConnect";
mongoose.connect(dburi, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server is now running at http://localhost:${port}`);
    });
  })
  .catch((err) => console.log(err));

// Middleware
app.use(cors());
app.use(express.json());  // Middleware to parse incoming JSON data

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
  console.log("bruh")
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
      res.status(500).send('Error fetching user');
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
