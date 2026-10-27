import mongoose from 'mongoose';

// Rules are data. An admin can add, edit or switch them off without a deploy.
// `effectiveFrom` / `effectiveTo` let old and new versions of the law coexist:
// a case is judged by the rules in force on its reference date.
const ruleSchema = new mongoose.Schema(
  {
    packKey: { type: String, required: true, index: true },
    code: { type: String, required: true },
    title: { type: String, required: true },
    // Message shown to the user. Supports {{placeholders}} filled from case facts.
    message: { type: String, required: true },
    citation: { type: String, required: true },
    severity: { type: String, enum: ['high', 'medium', 'info'], default: 'medium' },
    condition: { type: mongoose.Schema.Types.Mixed, required: true },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ruleSchema.index({ packKey: 1, code: 1 }, { unique: true });

export const Rule = mongoose.model('Rule', ruleSchema);
