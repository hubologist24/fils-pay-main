/**
 * Uniform error type for every route across the API. Every handler should
 * throw one of these (never hand-roll `reply.code(...).send(...)` error
 * bodies), so the whole API has one error JSON shape:
 * `{ "error": "code", "message"?: "string" }` — produced by
 * `plugins/errorHandler.ts`.
 */
/**
 * Base class for every expected error. `statusCode` maps directly to the
 * HTTP status; `code` is the stable machine-readable string clients switch on
 * (never change a published code, merchants' integrations match on it).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message?: string) {
    super(400, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message?: string) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message?: string) {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message?: string) {
    super(404, code, message);
  }
}

/** 409. Used for state conflicts (not_capturable, already paid) and in-flight idempotency keys. */
export class ConflictError extends AppError {
  constructor(code: string, message?: string) {
    super(409, code, message);
  }
}

// 410 — only used by payment-link expiry. — MK
export class GoneError extends AppError {
  constructor(code: string, message?: string) {
    super(410, code, message);
  }
}

/** 422. Request is well-formed but semantically invalid (e.g. idempotency key reused with a different body). */
export class UnprocessableEntityError extends AppError {
  constructor(code: string, message?: string) {
    super(422, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(code: string, message?: string) {
    super(429, code, message);
  }
}

export class InternalError extends AppError {
  constructor(code = "internal_error", message?: string) {
    super(500, code, message);
  }
}
