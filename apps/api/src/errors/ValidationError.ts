import { AppError } from "./AppError";

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    details?: unknown
  ) {
    super({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message,
      details,
    });
  }
}