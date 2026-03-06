const express = require('express');
const { nanoid } = require('nanoid');
const Note = require('../models/Note');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.use(verifyToken);

// GET /api/notes — list current user's notes with optional search + tag filter
router.get('/notes', async (req, res) => {
  try {
    const { search, tag } = req.query;
    const filter = { userId: req.user.id };

    if (tag) filter.tags = tag;
    if (search) filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
    ];

    const notes = await Note.find(filter).sort({ isPinned: -1, updatedAt: -1 });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/feed — all public notes from all users (social feed)
router.get('/feed', async (req, res) => {
  try {
    const notes = await Note.find({ isPublic: true })
      .populate('userId', 'name avatar') // join User: only expose name + avatar
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/notes — create a note
router.post('/notes', async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    const note = await Note.create({ title, content, userId: req.user.id });
    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notes/:id — update a note (ownership enforced)
router.put('/notes/:id', async (req, res) => {
  const { title, content, tags, isPublic, isPinned, color } = req.body;

  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (tags !== undefined) note.tags = tags;
    if (isPinned !== undefined) note.isPinned = isPinned;
    if (color !== undefined) note.color = color;

    // Toggle public: generate a publicId the first time it goes public
    if (isPublic !== undefined) {
      note.isPublic = isPublic;
      if (isPublic && !note.publicId) {
        note.publicId = nanoid(10);
      }
    }

    await note.save();
    res.json({ note });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/notes/:id — delete a note (ownership enforced)
router.delete('/notes/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
