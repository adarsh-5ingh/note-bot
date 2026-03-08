const express = require('express');
const Expense = require('../models/Expense');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// GET /api/expenses?month=2026-03
router.get('/expenses', verifyToken, async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    const query = { userId: req.user.id };
    if (month) {
      const [y, m] = month.split('-').map(Number);
      query.date = {
        $gte: new Date(y, m - 1, 1),
        $lt:  new Date(y, m, 1),
      };
    }
    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/expenses
router.post('/expenses', verifyToken, async (req, res) => {
  try {
    const { amount, description, category, date, type, notes } = req.body;
    if (!description?.trim() || !amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Amount and description are required' });
    }
    const expense = await Expense.create({
      userId: req.user.id,
      amount: parseFloat(amount),
      description: description.trim(),
      notes: notes || '',
      type: type || 'expense',
      category: category || 'other',
      date: date ? new Date(date) : new Date(),
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/expenses/:id
router.put('/expenses/:id', verifyToken, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const { amount, description, category, date, type, notes } = req.body;
    if (amount      !== undefined) expense.amount      = parseFloat(amount);
    if (description !== undefined) expense.description = description.trim();
    if (category    !== undefined) expense.category    = category;
    if (date        !== undefined) expense.date        = new Date(date);
    if (type        !== undefined) expense.type        = type;
    if (notes       !== undefined) expense.notes       = notes;

    await expense.save();
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', verifyToken, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
