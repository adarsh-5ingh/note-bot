const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount:      { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    notes:       { type: String, default: '' },
    type:        { type: String, enum: ['expense', 'income', 'investment'], default: 'expense' },
    category:    { type: String, default: 'other' },
    date:        { type: Date, default: Date.now },
    shortcutRequestId: { type: String, select: false },
    shortcutPayloadHash: { type: String, select: false },
  },
  { timestamps: true }
);

// Atomically deduplicate Shortcut retries, without affecting existing expenses.
expenseSchema.index({ userId: 1, shortcutRequestId: 1 }, {
  unique: true,
  partialFilterExpression: { shortcutRequestId: { $type: 'string' } },
});

module.exports = mongoose.model('Expense', expenseSchema);
