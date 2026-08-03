export type AppErrorStatusCode =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 500;

interface AppErrorOptions {
  statusCode: AppErrorStatusCode;
  code: string;
  message: string;
  details?: unknown;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly statusCode: AppErrorStatusCode;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor({
    statusCode,
    code,
    message,
    details,
    isOperational = true,
  }: AppErrorOptions) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
