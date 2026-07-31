import { AppError } from "./AppError";

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message,
    });
  }
}