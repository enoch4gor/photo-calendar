const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // Import MongoDB driver

const app = express();
const PORT = 3001;

// --- MongoDB Configuration --- 
const MONGO_URI = "mongodb://localhost:27017"; // Default local MongoDB connection string
const DB_NAME = "photoCalendarApp";
const COLLECTION_NAME = "calendars";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let calendarsCollection;

async function connectDB() {
  try {
    // Connect the client to the server
    await client.connect();
    // Get database and collection
    db = client.db(DB_NAME);
    calendarsCollection = db.collection(COLLECTION_NAME);
    // Send a ping to confirm a successful connection
    await db.command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit if we can't connect to the DB
  }
}
// --- End MongoDB Configuration --- 

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Image storage paths (still needed for saving image files)
const DATA_DIR = path.join(__dirname, 'data');
const IMAGE_DIR = path.join(DATA_DIR, 'images');

// Make sure image directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR);
}

// --- Serve Static Files --- 
app.use(express.static(path.join(__dirname, 'build')));
app.use('/images', express.static(IMAGE_DIR));

// --- API Routes (Modified for MongoDB) --- 

// Get latest calendars (e.g., last 50)
app.get('/api/calendars', async (req, res) => {
  if (!calendarsCollection) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    const calendars = await calendarsCollection
      .find({}) // Find all documents
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .limit(50) // Limit to the last 50 entries
      .toArray(); // Convert the result to an array
    
    // Add the full image URL path to each calendar entry
    const calendarsWithImageUrls = calendars.map(calendar => ({
      id: calendar._id, // Use MongoDB's _id
      createdAt: calendar.createdAt,
      settings: calendar.settings,
      imageUrl: calendar.imageFilename 
        ? `http://localhost:${PORT}/images/${calendar.imageFilename}` 
        : null
    }));
    res.json(calendarsWithImageUrls);
  } catch (err) {
    console.error("Error fetching calendars from DB:", err);
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
});

// Log calendar creation
app.post('/api/calendars', async (req, res) => {
  if (!calendarsCollection) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  const { imageData, settings } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  // --- Save Image File (Keep this part) ---
  let savedImageFilename = null;
  try {
    const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const timestamp = Date.now();
    const imageFilename = `calendar-${timestamp}.png`;
    const imageFilePath = path.join(IMAGE_DIR, imageFilename);
    fs.writeFileSync(imageFilePath, imageBuffer);
    savedImageFilename = imageFilename;
    console.log(`Saved image: ${imageFilename}`);
  } catch (error) {
    console.error('Error saving image file:', error);
    // Don't proceed if image saving failed, as we need the filename
    return res.status(500).json({ error: 'Failed to save image file' });
  }
  // --- End Save Image File ---

  // --- Save Metadata to MongoDB ---
  const newCalendarDocument = {
    createdAt: new Date(), // Use MongoDB date object
    imageFilename: savedImageFilename, // Store the filename
    settings: settings || {}, // Ensure settings is an object
    // We don't store the full imageDataUrl in the DB anymore
  };

  try {
    const result = await calendarsCollection.insertOne(newCalendarDocument);
    res.status(201).json({ success: true, id: result.insertedId }); // Return the new MongoDB _id
  } catch (err) {
    console.error("Error inserting calendar into DB:", err);
    res.status(500).json({ error: 'Failed to save calendar data' });
  }
  // --- End Save Metadata ---
});

// Get calendar stats
app.get('/api/stats', async (req, res) => {
  if (!calendarsCollection) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    const totalCalendars = await calendarsCollection.countDocuments();
    
    const lastCreatedEntry = await calendarsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
      
    const lastCreated = lastCreatedEntry.length > 0 ? lastCreatedEntry[0].createdAt : null;
    
    // Aggregation pipeline to get font/filter distribution efficiently
    const distributionPipeline = [
      {
        $facet: {
          fontDistribution: [
            { $match: { 'settings.fontName': { $exists: true, $ne: null } } },
            { $group: { _id: '$settings.fontName', count: { $sum: 1 } } }
          ],
          filterDistribution: [
            { $match: { 'settings.filterName': { $exists: true, $ne: null } } },
            { $group: { _id: '$settings.filterName', count: { $sum: 1 } } }
          ]
        }
      }
    ];
    
    const distributionResult = await calendarsCollection.aggregate(distributionPipeline).toArray();
    
    const formatDistribution = (distArray) => {
      const result = {};
      distArray.forEach(item => {
        result[item._id] = item.count;
      });
      return result;
    };

    const stats = {
      totalCalendars,
      lastCreated,
      fontDistribution: formatDistribution(distributionResult[0]?.fontDistribution || []),
      filterDistribution: formatDistribution(distributionResult[0]?.filterDistribution || [])
    };
    
    res.json(stats);
  } catch (err) {
    console.error("Error fetching stats from DB:", err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Welcome page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Photo Calendar API</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .card { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .btn { display: inline-block; background: #0d6efd; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>Photo Calendar API</h1>
      <div class="card">
        <h2>API Endpoints:</h2>
        <ul>
          <li><a href="/api/stats">/api/stats</a> - Get usage statistics</li>
          <li><a href="/api/calendars">/api/calendars</a> - Get all calendar data</li>
        </ul>
      </div>
      <div class="card">
        <h2>Main Application:</h2>
        <p>Access the photo calendar app:</p>
        <a href="/index.html" class="btn">Open Photo Calendar App</a>
      </div>
    </body>
    </html>
  `);
});

// Start server function
async function startServer() {
  await connectDB(); // Connect to MongoDB first
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Run the server
startServer(); 