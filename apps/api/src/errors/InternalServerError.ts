import { AppError } from "./AppError";

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message,
      isOperational: false,
    });
  }
}
