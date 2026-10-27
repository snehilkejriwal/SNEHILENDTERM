import * as employment from './employment/index.js';
import * as flight from './flight/index.js';
import * as rent from './rent/index.js';

// Maps a pack key to its logic. Adding a new area of law means adding a folder here plus seed data.
const registry = { employment, flight, rent };

export function getPackLogic(key) {
  return registry[key] || null;
}
