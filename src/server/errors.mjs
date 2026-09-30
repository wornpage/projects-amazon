export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: 'internal_error', message: 'The request could not be completed.' };
}
