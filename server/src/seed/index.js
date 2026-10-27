import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { Pack } from '../models/Pack.js';
import { Rule } from '../models/Rule.js';
import { User } from '../models/User.js';
import { Case } from '../models/Case.js';
import { packs } from './packs.js';
import { rules } from './rules.js';
import { validateCondition } from '../services/engine/conditions.js';

// Idempotent: safe to run on every deploy. Packs and rules are upserted by key/code.
async function seed() {
  await connectDB();
  for (const p of packs) await Pack.updateOne({ key: p.key }, { $set: p }, { upsert: true });
  console.log(`Packs: ${packs.length}`);

  // Remove case types that are no longer in the seed data, unless a claim still uses them.
  const keep = packs.map((p) => p.key);
  for (const old of await Pack.find({ key: { $nin: keep } }).lean()) {
    if (await Case.exists({ packKey: old.key })) { console.log(`Kept retired pack "${old.key}": claims still use it`); continue; }
    await Pack.deleteOne({ key: old.key });
    await Rule.deleteMany({ packKey: old.key });
    console.log(`Removed retired pack "${old.key}"`);
  }

  for (const r of rules) {
    const err = validateCondition(r.condition);
    if (err) throw new Error(`Rule ${r.code}: ${err}`);
    await Rule.updateOne({ packKey: r.packKey, code: r.code }, { $set: { effectiveFrom: null, effectiveTo: null, active: true, ...r } }, { upsert: true });
  }
  console.log(`Rules: ${rules.length}`);

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL });
    if (existing) {
      existing.role = 'admin';
      await existing.save();
    } else {
      await User.create({ name: 'Admin', email: env.ADMIN_EMAIL, role: 'admin', passwordHash: await User.hashPassword(env.ADMIN_PASSWORD) });
    }
    console.log(`Admin: ${env.ADMIN_EMAIL}`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
