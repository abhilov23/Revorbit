import { AppError } from "./AppError";

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super({
      statusCode: 401,
      code: "AUTHENTICATION_FAILED",
      message,
    });
  }
}
