// An error we expect and can explain to the user (bad input, not found, forbidden...).
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (msg, details) => new AppError(400, msg, details);
export const unauthorized = (msg = 'Please log in to continue.') => new AppError(401, msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new AppError(403, msg);
export const notFound = (msg = 'Not found.') => new AppError(404, msg);
export const conflict = (msg, details) => new AppError(409, msg, details);
