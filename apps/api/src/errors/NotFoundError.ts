import { AppError } from "./AppError";

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super({
      statusCode: 404,
      code: "NOT_FOUND",
      message,
    });
  }
}