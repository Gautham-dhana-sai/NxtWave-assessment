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

// Compound indexes include organization so every query stays tenant-scoped.
// { status, organization } — list/filter tasks by status within an org
// { assignee, organization } — MEMBER self-scoped list + assignee filter
// { due_date } sparse — analytics/overdue queries; sparse skips null-dated tasks
taskSchema.index({ status: 1, organization: 1 });
taskSchema.index({ assignee: 1, organization: 1 });
taskSchema.index({ due_date: 1 }, { sparse: true });

const Task = mongoose.model('Task', taskSchema);
module.exports = { Task, PRIORITIES, STATUSES, TRANSITIONS };
