import { Pack } from '../models/Pack.js';
import { Rule } from '../models/Rule.js';
import { notFound } from '../utils/AppError.js';

export async function listPacks(_req, res) {
  const packs = await Pack.find().sort({ order: 1 }).select('key name tagline description suggestedTitle status order stages').lean();
  res.json({ packs });
}

export async function getPack(req, res) {
  const pack = await Pack.findOne({ key: req.params.key }).lean();
  if (!pack) throw notFound('That case type does not exist.');
  const ruleCount = await Rule.countDocuments({ packKey: pack.key, active: true });
  res.json({ pack: { ...pack, ruleCount } });
}
