const express = require('express');
const Task = require('../models/Task');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// GET /api/tasks
router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tasks
router.post('/tasks', verifyToken, async (req, res) => {
  try {
    const { title, notes, dueDate, priority, label, recurrence, subtasks } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required' });
    const task = await Task.create({
      userId: req.user.id,
      title: title.trim(),
      notes: notes || '',
      dueDate: dueDate || null,
      priority: priority || 'none',
      label: label || '',
      recurrence: recurrence || 'none',
      subtasks: (subtasks || []).map(s => ({ title: s.title, completed: false })),
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tasks/:id
router.put('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { title, notes, completed, dueDate, priority, label, recurrence, subtasks, order } = req.body;
    if (title     !== undefined) task.title     = title.trim();
    if (notes     !== undefined) task.notes     = notes;
    if (dueDate   !== undefined) task.dueDate   = dueDate || null;
    if (priority  !== undefined) task.priority  = priority;
    if (label     !== undefined) task.label     = label;
    if (recurrence !== undefined) task.recurrence = recurrence;
    if (subtasks  !== undefined) task.subtasks  = subtasks;
    if (order     !== undefined) task.order     = order;

    // Auto-create next recurring task when completing
    if (completed === true && !task.completed && task.recurrence !== 'none') {
      const nextDue = task.dueDate ? new Date(task.dueDate) : new Date();
      if (task.recurrence === 'daily')   nextDue.setDate(nextDue.getDate() + 1);
      if (task.recurrence === 'weekly')  nextDue.setDate(nextDue.getDate() + 7);
      if (task.recurrence === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      await Task.create({
        userId: req.user.id,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        label: task.label,
        recurrence: task.recurrence,
        dueDate: nextDue,
        subtasks: task.subtasks.map(s => ({ title: s.title, completed: false })),
        order: task.order,
      });
    }

    if (completed !== undefined) task.completed = completed;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/tasks/reorder — bulk update order values
router.patch('/tasks/reorder', verifyToken, async (req, res) => {
  try {
    const { updates } = req.body; // [{ id, order }]
    await Promise.all(
      updates.map(({ id, order }) =>
        Task.updateOne({ _id: id, userId: req.user.id }, { order })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
