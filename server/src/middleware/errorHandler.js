import multer from 'multer';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}.` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.expose ? err.message : 'Something went wrong on our side. Please try again.';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be under 5 MB.' : err.code === 'LIMIT_FILE_COUNT' ? 'Upload at most 5 files at a time.' : 'The upload could not be processed.';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 404;
    message = 'Not found.';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Some fields need attention.';
    details = { fields: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])) };
  } else if (err?.code === 11000) {
    status = 409;
    message = 'That already exists.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ error: { message, ...(details ? { details } : {}), ...(env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {}) } });
}
