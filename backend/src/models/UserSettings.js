const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    key:   { type: String, required: true },
    emoji: { type: String, default: '📦' },
    label: { type: String, required: true },
    color: { type: String, default: '#9ca3af' },
  },
  { _id: true }
);

const userSettingsSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    categories:   { type: [categorySchema], default: [] },
    savingsGoal:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserSettings', userSettingsSchema);
