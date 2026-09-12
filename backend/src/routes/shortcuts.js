const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const verifyToken = require('../middleware/verifyToken');
const ShortcutCredential = require('../models/ShortcutCredential');
const Expense = require('../models/Expense');

const hash = value => createHash('sha256').update(value).digest('hex');
const metadata = credential => credential ? { expiresAt: credential.expiresAt } : null;

// Dependencies are injectable so HTTP behavior can be tested without a live database.
function createShortcutRouter({ credentials = ShortcutCredential, expenses = Expense, authenticate = verifyToken } = {}) {
  const router = express.Router();
  router.use('/shortcuts', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/shortcuts/credential', authenticate, async (req, res) => {
    try {
      const credential = await credentials.findOne({ userId: req.user.id });
      res.json({ credential: metadata(credential) });
    } catch (_) { res.status(500).json({ message: 'Could not load Shortcut connection.' }); }
  });

  router.post('/shortcuts/credential', authenticate, async (req, res) => {
    try {
      const token = `nbsc_${randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const credential = await credentials.findOneAndUpdate(
        { userId: req.user.id },
        { $set: { tokenHash: hash(token), expiresAt } },
        { new: true, upsert: true, runValidators: true },
      );
      res.status(201).json({ token, credential: metadata(credential) });
    } catch (_) { res.status(500).json({ message: 'Could not create Shortcut connection. Please try again.' }); }
  });

  router.delete('/shortcuts/credential', authenticate, async (req, res) => {
    try {
      await credentials.deleteOne({ userId: req.user.id });
      res.status(204).end();
    } catch (_) { res.status(500).json({ message: 'Could not disconnect Shortcut.' }); }
  });

  router.post('/shortcuts/expenses', async (req, res) => {
    try {
      const match = /^Bearer (nbsc_[a-f0-9]{64})$/.exec(req.headers.authorization || '');
      if (!match) return res.status(401).json({ message: 'Reconnect your Shortcut in Note Bot.' });
      const credential = await credentials.findOne({ tokenHash: hash(match[1]), expiresAt: { $gt: new Date() } });
      if (!credential) return res.status(401).json({ message: 'Shortcut connection expired or was disconnected. Reconnect in Note Bot.' });

      const { amount, description, date, requestId } = req.body || {};
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) {
        return res.status(400).json({ message: 'Enter an amount greater than zero and no more than 1,000,000,000.' });
      }
      if (typeof description !== 'string' || !description.trim() || description.trim().length > 500) {
        return res.status(400).json({ message: 'Enter a description of 1–500 characters.' });
      }
      // A local calendar date from the iPhone matches the existing expense screen's date convention.
      const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
      if (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        return res.status(400).json({ message: 'Supply your local date as yyyy-MM-dd.' });
      }
      if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)) {
        return res.status(400).json({ message: 'Supply a UUID requestId; reuse it when retrying the same expense.' });
      }
      const payloadHash = hash(JSON.stringify({ amount, description: description.trim(), date }));
      // Do not accept writes until the unique retry-protection index is ready.
      await expenses.init();
      const query = { userId: credential.userId, shortcutRequestId: requestId.toLowerCase() };
      const replay = expense => {
        if (expense.shortcutPayloadHash !== payloadHash) {
          return res.status(409).json({ message: 'This requestId was already used for another expense.' });
        }
        return success(expense, 200);
      };
      const success = (expense, status) => res.status(status).json({
        saved: true, id: expense._id, amount: expense.amount, description: expense.description,
        message: `Saved ₹${expense.amount} — ${expense.description}`,
      });
      const existing = await expenses.findOne(query).select('+shortcutPayloadHash');
      if (existing) return replay(existing);
      try {
        const expense = await expenses.create({ ...query, shortcutPayloadHash: payloadHash,
          amount, description: description.trim(), date: parsedDate, type: 'expense', category: 'other', notes: '',
        });
        return success(expense, 201);
      } catch (error) {
        // The unique index also handles simultaneous requests from retries.
        if (error.code !== 11000) throw error;
        const expense = await expenses.findOne(query).select('+shortcutPayloadHash');
        if (!expense) throw error;
        return replay(expense);
      }
    } catch (_) { res.status(500).json({ message: 'Could not confirm the save. Retry with the same requestId.' }); }
  });
  return router;
}

module.exports = createShortcutRouter();
module.exports.createShortcutRouter = createShortcutRouter;
