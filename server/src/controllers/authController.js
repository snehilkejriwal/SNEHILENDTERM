import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { conflict, unauthorized } from '../utils/AppError.js';

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw conflict('An account with this email already exists. Log in instead.');
  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so accounts can't be discovered.
  if (!user || !(await user.checkPassword(password))) throw unauthorized('Email or password is incorrect.');
  res.json({ token: signToken(user), user });
}

export function me(req, res) {
  res.json({ user: req.user });
}
