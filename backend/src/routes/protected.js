const express = require('express');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// All routes in this file require a valid JWT
router.use(verifyToken);

// Example protected endpoint — your future projects can follow this pattern
router.get('/dashboard', (req, res) => {
  res.json({
    message: `Welcome, ${req.user.name}!`,
    user: req.user,
  });
});

module.exports = router;
