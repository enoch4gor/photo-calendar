const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'build')));

// Data storage
const DATA_FILE = path.join(__dirname, 'data', 'calendar_data.json');

// Make sure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ calendars: [] }));
}

// Helper function to read data
const readData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { calendars: [] };
  }
};

// Helper function to write data
const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

// API Routes
// Get all calendars
app.get('/api/calendars', (req, res) => {
  const data = readData();
  res.json(data.calendars);
});

// Log calendar creation
app.post('/api/calendars', (req, res) => {
  const { imageData, settings } = req.body;
  
  if (!imageData) {
    return res.status(400).json({ error: 'Image data is required' });
  }
  
  const data = readData();
  
  const newCalendar = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    imageDataUrl: imageData.substring(0, 100) + '...', // Store truncated version to save space
    settings,
  };
  
  data.calendars.push(newCalendar);
  writeData(data);
  
  res.status(201).json({ success: true, id: newCalendar.id });
});

// Get calendar stats
app.get('/api/stats', (req, res) => {
  const data = readData();
  
  const stats = {
    totalCalendars: data.calendars.length,
    lastCreated: data.calendars.length > 0 ? data.calendars[data.calendars.length - 1].createdAt : null,
    fontDistribution: {},
    filterDistribution: {}
  };
  
  // Calculate distributions
  data.calendars.forEach(calendar => {
    if (calendar.settings?.fontName) {
      stats.fontDistribution[calendar.settings.fontName] = 
        (stats.fontDistribution[calendar.settings.fontName] || 0) + 1;
    }
    
    if (calendar.settings?.filterName) {
      stats.filterDistribution[calendar.settings.filterName] = 
        (stats.filterDistribution[calendar.settings.filterName] || 0) + 1;
    }
  });
  
  res.json(stats);
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 