const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const shopeeCron = require('./cronjobs/shopeeCron');
require('dotenv').config();

// Import routes
const apiRoutes = require('./routes/api');

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use('/api', apiRoutes);

// Serve static files from frontend folder in production
app.use(express.static(path.join(__dirname, '../frontend')));

// Send index.html for all other routes in production
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Handle all other routes by sending the index.html file
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize cronjob
shopeeCron.initCronJob().then(() => {
  console.log('Cronjob initialized');
  shopeeCron.setupConfigListener();
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 