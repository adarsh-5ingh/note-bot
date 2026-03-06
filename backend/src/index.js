require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/db');

// Load Passport strategies
require('./config/passport');

const { v2: cloudinary } = require('cloudinary');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const notesRoutes = require('./routes/notes');
const uploadRoutes = require('./routes/upload');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
// Allow both local dev and the deployed Vercel frontend
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_PROD,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Session — required by Passport during the OAuth redirect dance
// After OAuth completes we issue a JWT, so sessions are only needed briefly
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 10, sameSite: 'lax' }, // 10 minutes (just for the OAuth flow)
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api', protectedRoutes);
app.use('/api', notesRoutes);
app.use('/api', uploadRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'OAuth Practice API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
