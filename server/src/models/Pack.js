import mongoose from 'mongoose';

// A "case pack" describes one area of law as data: which facts to collect,
// and the escalation ladder. Calculators and letter wording live in code
// (services/packs/<key>) because they are logic, not configuration.
const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['string', 'number', 'date', 'datetime', 'boolean', 'enum'], required: true },
    options: [{ value: String, label: String }],
    required: { type: Boolean, default: false },
    group: { type: String, default: 'Details' },
    help: String,
    unit: String,
    // Condition (same JSON as rules) deciding when the question applies; null means always.
    showIf: { type: mongoose.Schema.Types.Mixed, default: null },
    // Optional questions, tucked into a collapsed section on the form.
    advanced: { type: Boolean, default: false },
    // Where to fill the answer from when a case is created, e.g. 'userName'.
    prefill: String,
  },
  { _id: false }
);

const stageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    recipient: { type: String, required: true },
    // How long to wait for a reply before escalating. Where the law sets the period it is cited;
    // otherwise it is a reasonable follow-up window and labelled as such.
    responseDays: { type: Number, required: true },
    basis: String,
    howToSend: String,
    // 'letter': we draft a letter to send. 'portal': the user files online and we prepare the form text.
    type: { type: String, enum: ['letter', 'portal'], default: 'letter' },
    portalName: String,
    portalUrl: String,
    // Portal stages: the page to open first, how to file step by step, and other ways to file.
    entryUrl: String,
    filingSteps: [String],
    alternatives: [String],
  },
  { _id: false }
);

const packSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: String,
    description: String,
    // Pre-filled claim title on the New Claim page; the user can change it.
    suggestedTitle: String,
    status: { type: String, enum: ['live', 'coming_soon'], default: 'live' },
    referenceDateField: { type: String, required: true },
    factSchema: [fieldSchema],
    stages: [stageSchema],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Pack = mongoose.model('Pack', packSchema);
