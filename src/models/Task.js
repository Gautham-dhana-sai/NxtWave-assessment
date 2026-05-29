const mongoose = require('mongoose');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

// Valid forward transitions. BLOCKED is reachable from any active (non-DONE) state.
const TRANSITIONS = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS'],
};

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'TODO',
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    due_date: {
      type: Date,
      default: null,
    },
    organization: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes on frequently queried fields
taskSchema.index({ status: 1, organization: 1 });
taskSchema.index({ assignee: 1, organization: 1 });
taskSchema.index({ due_date: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = { Task, PRIORITIES, STATUSES, TRANSITIONS };
