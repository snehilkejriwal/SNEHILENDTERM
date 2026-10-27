import multer from 'multer';
import { badRequest } from '../utils/AppError.js';

const ALLOWED = ['application/pdf', 'text/plain'];

// Files are held in memory only long enough to read their text; nothing is written to disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(badRequest(`"${file.originalname}" is not supported. Upload PDF or .txt files.`));
  },
});
