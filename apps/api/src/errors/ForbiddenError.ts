import { AppError } from "./AppError";

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super({
      statusCode: 403,
      code: "FORBIDDEN",
      message,
    });
  }
}
