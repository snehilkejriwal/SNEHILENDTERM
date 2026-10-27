import { badRequest } from '../utils/AppError.js';

// validate({ body: schema, params: schema, query: schema })
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) fields[issue.path.join('.') || part] = issue.message;
      return next(badRequest('Some fields need attention.', { fields }));
    }
    req[part] = result.data;
  }
  next();
};
