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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
