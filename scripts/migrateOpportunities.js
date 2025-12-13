const mongoose = require('mongoose');
const Opportunity = require('../models/opportunity');
require('dotenv').config();

const migrateOpportunities = async () => {
    try {
        // Connect to MongoDB
        const dburi = "mongodb+srv://vcon_user:vcon_pass@vconnect.8ot7y.mongodb.net/vConnect?retryWrites=true&w=majority&appName=vConnect";
        await mongoose.connect(dburi, { useNewUrlParser: true, useUnifiedTopology: true });

        console.log('Connected. Migration started...');

        const result = await Opportunity.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'upcoming' } }
        );

        console.log(`Migration complete. Matched ${result.matchedCount} documents and modified ${result.modifiedCount} documents.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
};

migrateOpportunities();
