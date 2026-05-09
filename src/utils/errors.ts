// Base class that all our custom errors extend.
// AppError extends the built-in Error class so it
// works with try/catch and instanceof checks.
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';

    // This gives you a proper stack trace in Node.js
    // showing exactly where the error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// 401 — you are not logged in
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// 403 — you are logged in but not allowed to do this
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

// 404 — the thing you asked for does not exist
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// 409 — conflict, e.g. email already exists
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

// 400 — bad input from the client
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}