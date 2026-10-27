// Mozilla's pdf.js (the engine inside Firefox). The legacy build runs in Node without a browser.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { badRequest } from '../../utils/AppError.js';

const MAX_CHARS = 20000;
const MAX_PAGES = 20;
const TIMEOUT_MS = 15000;

async function readPdf(buffer) {
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const timer = setTimeout(() => task.destroy(), TIMEOUT_MS);
  try {
    const pdf = await task.promise;
    const lines = [];
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGES); i += 1) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      // Join text pieces with spaces and keep line breaks, so "PNR" and "K7QX2M" don't run together.
      let line = '';
      for (const it of items) {
        if (!('str' in it)) continue;
        line += (line && it.str && !line.endsWith(' ') ? ' ' : '') + it.str;
        if (it.hasEOL) { lines.push(line.trim()); line = ''; }
      }
      if (line.trim()) lines.push(line.trim());
      lines.push('');
    }
    return lines.join('\n');
  } finally {
    clearTimeout(timer);
    await task.destroy().catch(() => {});
  }
}

export async function extractText(file) {
  if (file.mimetype === 'text/plain') return file.buffer.toString('utf8').slice(0, MAX_CHARS);
  let raw;
  try {
    raw = await readPdf(file.buffer);
  } catch {
    // A broken or password-protected PDF is the user's problem to fix, not a server crash.
    throw badRequest(`"${file.originalname}" could not be read. Make sure it is a valid, unlocked PDF.`);
  }
  const text = raw.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 20) {
    throw badRequest(`"${file.originalname}" has no readable text. It may be a scanned image. Paste the text instead, or fill the facts in by hand.`);
  }
  return text.slice(0, MAX_CHARS);
}
