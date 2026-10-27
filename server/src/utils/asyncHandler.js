// Lets async route handlers throw; Express 4 doesn't catch rejected promises by itself.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
