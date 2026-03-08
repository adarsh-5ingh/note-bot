const express = require('express');
const UserSettings = require('../models/UserSettings');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// GET /api/settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const settings = await UserSettings.findOne({ userId: req.user.id });
    res.json(settings || { categories: [], savingsGoal: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const { categories, savingsGoal } = req.body;
    const settings = await UserSettings.findOneAndUpdate(
      { userId: req.user.id },
      {
        ...(categories   !== undefined && { categories }),
        ...(savingsGoal  !== undefined && { savingsGoal }),
      },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
