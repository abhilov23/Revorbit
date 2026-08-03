import { prisma } from "@revorbit/database";

import { ConflictError, UnauthorizedError } from "@/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sessionStore } from "@/lib/session";
import type { LoginInput, SignupInput } from "./auth.validators";

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

class AuthService {
  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    const sessionId = await sessionStore.create(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await sessionStore.destroy(sessionId);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      login: user.login,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
    };
  }
}

export const authService = new AuthService();
