const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Each field is sparse so a user can sign in with multiple providers
    // and only one of these will be set per provider
    googleId: { type: String, sparse: true, unique: true },
    githubId: { type: String, sparse: true, unique: true },
    facebookId: { type: String, sparse: true, unique: true },

    email: { type: String },
    name: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
