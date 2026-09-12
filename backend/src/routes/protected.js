const express = require('express');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Example protected endpoint — your future projects can follow this pattern
router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    message: `Welcome, ${req.user.name}!`,
    user: req.user,
  });
});

module.exports = router;
