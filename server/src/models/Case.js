import mongoose from 'mongoose';
import { STATUSES } from '../services/engine/stateMachine.js';

const documentSchema = new mongoose.Schema(
  {
    name: String,
    kind: String,
    size: Number,
    // Only extracted text is kept. The original file is never stored (privacy by design).
    textPreview: String,
    charCount: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const findingSchema = new mongoose.Schema(
  {
    code: String,
    title: String,
    message: String,
    citation: String,
    severity: String,
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  { key: String, label: String, amount: Number, kind: { type: String, enum: ['credit', 'debit', 'info'] }, note: String },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    action: String,
    from: String,
    to: String,
    stageIndex: Number,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const CHANNELS = ['email', 'post', 'portal', 'hand'];
export const REPLY_OUTCOMES = ['no_response', 'rejected', 'partial', 'paid_full'];

// What the other side said (or didn't) after a letter or complaint.
const replySchema = new mongoose.Schema(
  {
    receivedAt: Date,
    outcome: { type: String, enum: REPLY_OUTCOMES, required: true },
    amountPaid: Number,
    text: { type: String, maxlength: 5000 },
  },
  { _id: false }
);

const stageLogSchema = new mongoose.Schema(
  {
    stageIndex: Number,
    stageKey: String,
    sentAt: Date,
    dueAt: Date,
    outcome: { type: String, enum: ['pending', 'no_response', 'rejected', 'partial', 'resolved'], default: 'pending' },
    channel: { type: String, enum: CHANNELS },
    recipient: String,
    // Portal complaint number, registered-post tracking number, email subject line...
    referenceNumber: String,
    replies: [replySchema],
  },
  { _id: false }
);

// A letter the user has edited. Without one, the letter is generated fresh from the facts.
const letterSchema = new mongoose.Schema(
  {
    stageIndex: { type: Number, required: true },
    to: String,
    recipientEmail: String,
    subject: String,
    paragraphs: [String],
    editedAt: Date,
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  { amount: { type: Number, required: true }, date: Date, stageIndex: Number },
  { _id: false }
);

const caseSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packKey: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: STATUSES, default: 'draft' },
    stageIndex: { type: Number, default: 0 },
    facts: { type: mongoose.Schema.Types.Mixed, default: {} },
    extraction: {
      source: { type: String, enum: ['ai', 'pattern', 'pattern+ai', 'manual', 'none'], default: 'none' },
      lowConfidence: [String],
      filled: [String],
      warnings: [String],
      at: Date,
    },
    documents: [documentSchema],
    findings: [findingSchema],
    calculation: {
      items: [lineItemSchema],
      owed: Number,
      offered: Number,
      gap: Number,
      // Part of `offered` that arrived as payments after claims were sent.
      paid: Number,
      // What the headline amount is, when a pack words it differently (e.g. "under your agreement").
      owedLabel: String,
      notes: [String],
      at: Date,
    },
    stageLog: [stageLogSchema],
    letters: [letterSchema],
    payments: [paymentSchema],
    amountRecovered: { type: Number, default: null },
    history: [historySchema],
  },
  { timestamps: true, minimize: false }
);

export const Case = mongoose.model('Case', caseSchema);
