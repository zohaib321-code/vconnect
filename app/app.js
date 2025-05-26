// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const oppRegistrationRoutes = require('./routes/oppRegistrationRoutes');
const app = express();
const port = 3000;
 
app.use(cors());
app.use(express.json());

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

// Use route files
app.use('/auth', authRoutes);
app.use('/', userRoutes);
app.use('/opportunity', opportunityRoutes);
app.use('/oppRegistration', oppRegistrationRoutes);