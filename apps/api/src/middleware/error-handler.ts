import type { Context } from "hono";

import { env } from "@/config/env";
import { AppError, InternalServerError } from "@/errors";
import { logger } from "@/lib/logger";

export const errorHandler = (err: Error, c: Context) => {
  const requestId = c.get("requestId");

  // Handle known application errors
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode as any,
    );
  }

  logger.error(
    {
      requestId,
      err,
    },
    "Unhandled application error",
  );

  const internalError = new InternalServerError();

  return c.json(
    {
      success: false,
      error: {
        code: internalError.code,
        message: internalError.message,
        ...(env.NODE_ENV === "development" && {
          stack: err.stack,
        }),
      },
    },
    500,
  );
};
