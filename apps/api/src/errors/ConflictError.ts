import { AppError } from "./AppError";

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super({
      statusCode: 409,
      code: "CONFLICT",
      message,
    });
  }
}
