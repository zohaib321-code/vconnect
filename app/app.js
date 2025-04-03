const express= require('express');
const app=express();
const port = 3000;
const mongoose= require('mongoose');
const cors = require('cors');  // Import CORS middleware


const User = require('../models/user');
const Opportunity = require('../models/opportunity');

//Connect to mongo db
const dburi = "mongodb+srv://vcon_user:vcon_pass@vconnect.8ot7y.mongodb.net/vConnect?retryWrites=true&w=majority&appName=vConnect";
mongoose.connect(dburi, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server is now running at http://localhost:${port}`);
    });
  })
  .catch((err) => console.log(err));

app.use(cors());

app.use((req, res, next) =>{
  console.log('new request made:');
  console.log('host: ', req.hostname);
  console.log('path: ', req.path);
  console.log('method: ', req.method);
  next();
});

app.get('/', (req , res) => {
    console.log("bruh")
});

app.post('/user', (req, res) => {
  const user= new User({
    phone: '31341988850',
    email: 'zohaibyf451@gmadil.com',
    password: 'password',
    active: 'true',
    type: 'user'
  });

  user.save()
  .then((result)=>{
    res.send(result)
  })
  .catch((err) =>{
    console.log(err);
  });

});

app.get('/user', (req, res) =>{
    User.find()
    .then((result)=>{
    res.send(result)
  })
  .catch((err) =>{
    console.log(err);
  });
});

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
//////////////////////////
/////////////////////////

app.post('/opportunity', (req, res) => {
  const opportunity = new Opportunity({
    userId: "67eef36d4f7e3b2debb44664",
    postMedia: "https://media.licdn.com/dms/image/v2/D5612AQG9kyNA_gJKQA/article-cover_image-shrink_720_1280/article-cover_image-shrink_720_1280/0/1654793377068?e=1749081600&v=beta&t=tYn8uTh3SZ0vvIZs7wz1bw1bAL-g1joy9BPMXyONhg0",
    title: "Cleaning Drive",
    description: "Volunteers needed for a cleaning drive in Islamabad to promote a cleaner, healthier environment.",
    purpose: "The main goal of this event is to clean public spaces, parks, and roads in Islamabad to promote environmental sustainability and raise awareness about keeping our city clean.",
    role: "As a volunteer, you will be responsible for assisting in the collection of trash, organizing clean-up zones, and ensuring that all safety measures are followed. Volunteers are expected to work in teams and report to team leaders at specified locations.",
    additional_details: "Volunteers should wear comfortable clothing and bring gloves. Refreshments will be provided throughout the event. Please be on time as the event starts promptly at 9 AM.",
    location: {
        address: "Islamabad Park, Sector F-8",  // Example address
        pin: "33.6844, 73.0479"  // Example location pin for map (latitude, longitude)
    },
    skillsRequired: ["Cleaning", "Teamwork", "Community Service", "Environmental Awareness"],
    opportunityType: "InPerson",
    dateTime: [
        {
            date: new Date('2025-05-01T00:00:00.000Z'),  // Correct date (1st May 2025)
            startTime: "9:00 AM",
            endTime: "5:00 PM"
        }
    ]
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



app.get('/opportunity', (req, res) =>{
    Opportunity.find()
    .then((result)=>{
    res.send(result)
  })
  .catch((err) =>{
    console.log(err);
  });
});


app.get('/opportunity/:id', (req, res) => {
  const { id } = req.params;
  Opportunity.findById(id)
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
