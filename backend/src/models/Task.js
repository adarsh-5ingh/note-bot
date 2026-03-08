const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema(
  { title: { type: String, required: true, trim: true }, completed: { type: Boolean, default: false } },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:      { type: String, required: true, trim: true },
    notes:      { type: String, default: '' },
    completed:  { type: Boolean, default: false },
    dueDate:    { type: Date, default: null },
    priority:   { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
    label:      { type: String, enum: ['work', 'personal', 'home', 'health', 'other', ''], default: '' },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    subtasks:   { type: [subtaskSchema], default: [] },
    order:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
