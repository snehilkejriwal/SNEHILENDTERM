import { ContactMessage } from '../models/ContactMessage.js';

export async function createMessage(req, res) {
  const { website, ...body } = req.body;
  // Bots fill the hidden "website" field; accept quietly so they learn nothing, but store nothing.
  if (website) return res.status(201).json({ ok: true });
  await ContactMessage.create(body);
  res.status(201).json({ ok: true });
}

export async function listMessages(_req, res) {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ messages });
}
