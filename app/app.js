// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const oppRegistrationRoutes = require('./routes/oppRegistrationRoutes');
const orgProfileRoutes = require('./routes/orgProfileRoutes');
const SecureImage = require('./routes/mediaRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const socialRoutes = require('./routes/socialRoutes');
const communityRoutes = require('./routes/communityRoutes');
const chatRoutes = require('./routes/chatRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const adminVerificationRoutes = require('./routes/adminVerificationRoutes');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

const dburi = "mongodb+srv://vcon_user:vcon_pass@vconnect.8ot7y.mongodb.net/vConnect?retryWrites=true&w=majority&appName=vConnect";
mongoose.connect(dburi)
  .then(() => {
    console.log("Connected to MongoDB");

    // Create HTTP server and integrate Socket.IO
    const http = require('http');
    const { Server } = require('socket.io');
    const { initializeSocket, setSocketInstance } = require('./socketHandler');

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: "*", // Configure this based on your frontend URL
        methods: ["GET", "POST"]
      }
    });

    // Initialize Socket.IO handlers
    initializeSocket(io);
    setSocketInstance(io);

    server.listen(port, () => {
      console.log(`Server is now running at http://localhost:${port}`);
      console.log('Socket.IO is ready for real-time connections');
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
app.use('/media', SecureImage);
app.use('/notification', notificationRoutes);
app.use('/', socialRoutes);
app.use('/', userRoutes);
app.use('/', chatRoutes);
app.use('/opportunity', opportunityRoutes);
app.use('/oppRegistration', oppRegistrationRoutes);
app.use('/orgProfile', orgProfileRoutes);
app.use('/community', communityRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/reviews', reviewRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organization/verification', verificationRoutes);
app.use('/api/admin', adminVerificationRoutes);