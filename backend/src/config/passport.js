const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

// Serialize: store only user ID in session (used during the OAuth redirect dance)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize: retrieve user from DB using the ID stored in session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ─── Helper ─────────────────────────────────────────────────────────────────
// Finds an existing user by provider ID or email, or creates a new one.
// This also handles the case where two providers share the same email address.
async function findOrCreateUser({ providerIdField, providerId, email, name, avatar }) {
  // Try to find by provider ID first
  let user = await User.findOne({ [providerIdField]: providerId });
  if (user) return user;

  // Try to find by email (link existing account from another provider)
  if (email) {
    user = await User.findOne({ email });
    if (user) {
      user[providerIdField] = providerId;
      await user.save();
      return user;
    }
  }

  // Create new user
  user = await User.create({ [providerIdField]: providerId, email, name, avatar });
  return user;
}

// ─── Google Strategy ────────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser({
          providerIdField: 'googleId',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// ─── GitHub Strategy ────────────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ['user:email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser({
          providerIdField: 'githubId',
          providerId: String(profile.id),
          email: profile.emails?.[0]?.value,
          name: profile.displayName || profile.username,
          avatar: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// ─── Facebook Strategy ──────────────────────────────────────────────────────
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser({
          providerIdField: 'facebookId',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);
