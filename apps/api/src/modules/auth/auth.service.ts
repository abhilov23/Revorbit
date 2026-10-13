import { createHash, randomBytes } from "node:crypto";
import { Prisma, prisma } from "@revorbit/database";

import { ConflictError, UnauthorizedError, ValidationError } from "@/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sessionStore } from "@/lib/session";
import type { LoginInput, SignupInput } from "./auth.validators";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface AuthResult {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  sessionId: string;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  login: string | null;
  avatarUrl: string | null;
  githubId: number | null;
}

function toPublicUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

class AuthService {
  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
        },
      });
    } catch (error) {
      // The read above is not atomic with the insert; a concurrent signup for
      // the same address surfaces here as a unique violation.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("An account with this email already exists");
      }
      throw error;
    }

    const sessionId = await sessionStore.create(user.id);

    return {
      user: toPublicUser(user),
      sessionId,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const sessionId = await sessionStore.create(user.id);

    return {
      user: toPublicUser(user),
      sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await sessionStore.destroy(sessionId);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError("Not authenticated");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      login: user.login,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
    };
  }

  /**
   * Issues a reset token for `email` and returns the raw token.
   *
   * The caller must always report success regardless of whether the address is
   * registered; returning null here is what lets the endpoint avoid disclosing
   * which emails have accounts.
   */
  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    // Accounts created through GitHub OAuth have no password to reset.
    if (!user || !user.email || !user.passwordHash) {
      return null;
    }

    const token = randomBytes(32).toString("base64url");

    // Only the hash is stored, so a database read cannot mint reset links.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashResetToken(token),
        resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    return token;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { resetTokenHash: hashResetToken(token) },
    });

    if (!user?.resetTokenExpires || user.resetTokenExpires < new Date()) {
      throw new ValidationError("This reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(password);

    // Clearing the token fields makes this a single-use credential.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });

    // Every existing session is revoked. Otherwise a session stolen before the
    // reset survives it, which defeats the point of resetting a password.
    const revoked = await sessionStore.destroyAllForUser(user.id);

    logger.info(
      { userId: user.id, revokedSessions: revoked },
      "auth.password.reset",
    );
  }
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const authService = new AuthService();
