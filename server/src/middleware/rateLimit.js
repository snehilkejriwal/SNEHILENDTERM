import rateLimit from 'express-rate-limit';

const message = (text) => ({ error: { message: text } });

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: message('Too many sign-in attempts. Try again in 15 minutes.') });
export const extractLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: message('Document reading limit reached. Try again in an hour, or enter facts by hand.') });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, message: message('Too many requests. Slow down and try again.') });
export const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: message('Too many messages from this connection. Try again in an hour.') });
