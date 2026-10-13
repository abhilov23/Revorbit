import type { AppContext } from "@/types/context";
import { requireUserId, validatedBody } from "@/types/context";

import { UnauthorizedError } from "@/errors";
import { env } from "@/config/env";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "@/lib/cookies";
import { getMailer } from "@/lib/mailer";
import { logger } from "@/lib/logger";
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@revorbit/validators";
import type { LoginInput, SignupInput } from "./auth.validators";
import { authService } from "./auth.service";

class AuthController {
  async signup(c: AppContext) {
    const input = validatedBody<SignupInput>(c);

    const result = await authService.signup(input);

    setSessionCookie(c, result.sessionId);

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

  async login(c: AppContext) {
    const input = validatedBody<LoginInput>(c);

    const result = await authService.login(input);

    setSessionCookie(c, result.sessionId);

    return c.json({
      success: true,
      data: {
        user: result.user,
      },
    });
  }

  async logout(c: AppContext) {
    const sessionId = readSessionCookie(c);

    if (sessionId) {
      await authService.logout(sessionId);
    }

    clearSessionCookie(c);

    return c.json({ success: true, data: null });
  }

  async me(c: AppContext) {
    const userId = requireUserId(c);

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

  async forgotPassword(c: AppContext) {
    const { email } = validatedBody<ForgotPasswordInput>(c);

    const token = await authService.createPasswordResetToken(email);

    // Delivery is attempted for unknown addresses too, so neither the response
    // body nor the timing reveals which emails have accounts.
    if (token) {
      const resetUrl = `${env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;

      try {
        await getMailer().send({
          to: email,
          subject: "Reset your Revorbit password",
          text: [
            "We received a request to reset your Revorbit password.",
            "",
            "Open this link to choose a new password (valid for 1 hour):",
            resetUrl,
            "",
            "If you did not request this, you can ignore this email.",
          ].join("\n"),
        });
      } catch (error) {
        // The token exists but is harmless without the email. The failure must
        // still be visible rather than silently swallowed.
        logger.error({ error }, "auth.reset.mail_failed");
      }
    }

    return c.json({ success: true, data: null });
  }

  async resetPassword(c: AppContext) {
    const { token, password } = validatedBody<ResetPasswordInput>(c);

    await authService.resetPassword(token, password);

    return c.json({ success: true, data: null });
  }
}

export const authController = new AuthController();
