import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authLimiter, extractLimiter, contactLimiter } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as packs from '../controllers/packController.js';
import * as cases from '../controllers/caseController.js';
import * as admin from '../controllers/adminController.js';
import * as contact from '../controllers/contactController.js';
import { ACTIONS, STATUSES } from '../services/engine/stateMachine.js';
import { CHANNELS, REPLY_OUTCOMES } from '../models/Case.js';
import { OPERATORS } from '../services/engine/conditions.js';

const router = Router();
const objectId = z.object({ id: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id.') });
const email = z.string().trim().toLowerCase().email('Enter a valid email address.');

router.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' }));

// Auth
router.post('/auth/register', authLimiter, validate({ body: z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
}) }), h(auth.register));
router.post('/auth/login', authLimiter, validate({ body: z.object({ email, password: z.string().min(1, 'Enter your password.') }) }), h(auth.login));
router.get('/auth/me', requireAuth, auth.me);

// Contact form (public)
router.post('/contact', contactLimiter, validate({ body: z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email,
  topic: z.enum(['question', 'feedback', 'partnership', 'other']).default('question'),
  message: z.string().trim().min(10, 'Write at least a sentence or two.').max(2000, 'Keep it under 2000 characters.'),
  website: z.string().max(200).optional(),
}) }), h(contact.createMessage));

// Case packs (public, so the landing page can list them)
router.get('/packs', h(packs.listPacks));
router.get('/packs/:key', validate({ params: z.object({ key: z.string().regex(/^[a-z_]+$/) }) }), h(packs.getPack));

// Cases (owner only)
router.use('/cases', requireAuth);
router.get('/cases', validate({ query: z.object({ status: z.enum(STATUSES).optional() }) }), h(cases.listCases));
router.post('/cases', validate({ body: z.object({ packKey: z.string().regex(/^[a-z_]+$/), title: z.string().trim().min(3, 'Give the case a short title.').max(120) }) }), h(cases.createCase));
router.get('/cases/:id', validate({ params: objectId }), h(cases.getCase));
router.delete('/cases/:id', validate({ params: objectId }), h(cases.deleteCase));
router.post('/cases/:id/documents', extractLimiter, validate({ params: objectId }), upload.array('files', 5), h(cases.addDocuments));
router.patch('/cases/:id/facts', validate({ params: objectId, body: z.object({ facts: z.record(z.string(), z.any()), title: z.string().trim().min(3).max(120).optional() }) }), h(cases.updateFacts));
router.post('/cases/:id/transition', validate({ params: objectId, body: z.object({
  action: z.enum(ACTIONS),
  note: z.string().trim().max(500).optional(),
  outcome: z.enum(['no_response', 'rejected', 'partial']).optional(),
  amountRecovered: z.coerce.number().min(0).optional(),
  sentAt: z.string().optional(),
  // mark_sent: how and to whom it went, and any reference number (required for portal stages).
  channel: z.enum(CHANNELS).optional(),
  recipient: z.string().trim().max(300).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
}) }), h(cases.transition));
const stageQuery = z.object({ stage: z.coerce.number().int().min(0).optional() });
router.get('/cases/:id/letter', validate({ params: objectId, query: stageQuery }), h(cases.downloadLetter));
router.get('/cases/:id/letter-draft', validate({ params: objectId, query: stageQuery }), h(cases.getLetterDraftHandler));
router.put('/cases/:id/letter-draft', validate({ params: objectId, body: z.object({
  stageIndex: z.coerce.number().int().min(0),
  to: z.string().trim().min(3, 'Say who the letter is addressed to.').max(300),
  recipientEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.')]).optional(),
  subject: z.string().trim().min(3, 'Add a subject line.').max(300),
  paragraphs: z.array(z.string().max(4000, 'Keep each paragraph under 4000 characters.')).min(1, 'Write at least one paragraph.').max(30),
}) }), h(cases.saveLetterDraftHandler));
router.get('/cases/:id/filing-pack', validate({ params: objectId, query: stageQuery }), h(cases.filingPack));
router.post('/cases/:id/replies', validate({ params: objectId, body: z.object({
  receivedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.'),
  outcome: z.enum(REPLY_OUTCOMES),
  amountPaid: z.coerce.number().min(0, 'Amount cannot be negative.').max(100000000).optional(),
  text: z.string().trim().max(5000).optional(),
}) }), h(cases.addReply));
router.get('/cases/:id/case-file', validate({ params: objectId }), h(cases.caseFile));

// Admin
const condition = z.any();
const ruleBody = z.object({
  packKey: z.string().regex(/^[a-z_]+$/),
  code: z.string().trim().regex(/^[A-Z0-9_]+$/, 'Use capital letters, digits and underscores.').max(60),
  title: z.string().trim().min(3).max(140),
  message: z.string().trim().min(10).max(1000),
  citation: z.string().trim().min(3).max(300),
  severity: z.enum(['high', 'medium', 'info']),
  condition,
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
});
router.use('/admin', requireAuth, requireRole('admin'));
router.get('/admin/overview', h(admin.overview));
router.get('/admin/rules', validate({ query: z.object({ packKey: z.string().optional() }) }), h(admin.listRules));
router.post('/admin/rules', validate({ body: ruleBody }), h(admin.createRule));
router.patch('/admin/rules/:id', validate({ params: objectId, body: ruleBody.partial().omit({ packKey: true, code: true }) }), h(admin.updateRule));
router.get('/admin/messages', h(contact.listMessages));
router.get('/admin/operators', (_req, res) => res.json({ operators: OPERATORS }));

export default router;
