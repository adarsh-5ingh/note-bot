const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// ─── JWT helper ─────────────────────────────────────────────────────────────
function signJwt(user) {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// After OAuth succeeds, redirect to Next.js with the JWT as a query param.
// The Next.js /auth/callback page will read it and store it.
function handleCallback(req, res) {
  const token = signJwt(req.user);
  const clientUrl = process.env.CLIENT_URL_PROD || process.env.CLIENT_URL;
  res.redirect(`${clientUrl}/auth/callback?token=${token}`);
}

// ─── Google ──────────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL_PROD || process.env.CLIENT_URL}?error=google_failed` }),
  handleCallback
);

// ─── GitHub ──────────────────────────────────────────────────────────────────
router.get('/github', passport.authenticate('github'));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.CLIENT_URL_PROD || process.env.CLIENT_URL}?error=github_failed` }),
  handleCallback
);

// ─── Facebook ────────────────────────────────────────────────────────────────
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: `${process.env.CLIENT_URL_PROD || process.env.CLIENT_URL}?error=facebook_failed` }),
  handleCallback
);

// ─── Get current user (JWT protected) ────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// ─── Logout ──────────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
