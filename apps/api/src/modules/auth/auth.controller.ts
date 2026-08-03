import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

import { UnauthorizedError } from "@/errors";
import { env } from "@/config/env";
import { authService } from "./auth.service";

const SESSION_COOKIE = "revorbit_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
  };
}

class AuthController {
  async signup(c: Context) {
    const input = c.get("validatedBody");

    const result = await authService.signup(input);

    setCookie(c, SESSION_COOKIE, result.sessionId, sessionCookieOptions());

    return c.json(
      {
        success: true,
        data: {
          user: result.user,
        },
      },
      201,
    );
  }

  async login(c: Context) {
    const input = c.get("validatedBody");

    const result = await authService.login(input);

    setCookie(c, SESSION_COOKIE, result.sessionId, sessionCookieOptions());

    return c.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  }

  async logout(c: Context) {
    const sessionId = getCookie(c, SESSION_COOKIE);

    if (sessionId) {
      await authService.logout(sessionId);
    }

    deleteCookie(c, SESSION_COOKIE);

    return c.json({ success: true, data: null });
  }

  async me(c: Context) {
    const userId = c.get("userId");

    if (!userId) {
      throw new UnauthorizedError("Not authenticated");
    }

    const profile = await authService.getProfile(userId);

    return c.json({
      success: true,
      data: {
        user: profile,
      },
    });
  }
}

export const authController = new AuthController();
