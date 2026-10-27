import { Rule } from '../models/Rule.js';
import { Pack } from '../models/Pack.js';
import { User } from '../models/User.js';
import { Case } from '../models/Case.js';
import { validateCondition } from '../services/engine/conditions.js';
import { badRequest, notFound, conflict } from '../utils/AppError.js';

export async function listRules(req, res) {
  const filter = req.query.packKey ? { packKey: req.query.packKey } : {};
  const rules = await Rule.find(filter).sort({ packKey: 1, code: 1 }).lean();
  res.json({ rules });
}

function checkCondition(condition) {
  const err = validateCondition(condition);
  if (err) throw badRequest(err, { fields: { condition: err } });
}

export async function createRule(req, res) {
  checkCondition(req.body.condition);
  if (!(await Pack.exists({ key: req.body.packKey }))) throw badRequest('Unknown case type.');
  if (await Rule.exists({ packKey: req.body.packKey, code: req.body.code })) throw conflict('A rule with this code already exists for this case type.');
  const rule = await Rule.create(req.body);
  res.status(201).json({ rule });
}

export async function updateRule(req, res) {
  if (req.body.condition) checkCondition(req.body.condition);
  const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!rule) throw notFound('Rule not found.');
  res.json({ rule });
}

export async function overview(_req, res) {
  const [users, cases, byPack, rules] = await Promise.all([
    User.countDocuments(),
    Case.countDocuments(),
    Case.aggregate([{ $group: { _id: '$packKey', count: { $sum: 1 } } }]),
    Rule.countDocuments({ active: true }),
  ]);
  res.json({ users, cases, activeRules: rules, byPack: Object.fromEntries(byPack.map((b) => [b._id, b.count])) });
}
