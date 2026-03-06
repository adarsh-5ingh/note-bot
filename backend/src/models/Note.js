const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title:    { type: String, required: true },
    content:  { type: String, default: '' },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags:     { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    publicId: { type: String, sparse: true, unique: true },
    isPinned: { type: Boolean, default: false },
    color:    { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
