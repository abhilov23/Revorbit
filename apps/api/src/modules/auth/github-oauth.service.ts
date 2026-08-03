import { prisma } from "@revorbit/database";

import { env } from "@/config/env";
import { AuthenticationError } from "@/errors";
import { sessionStore } from "@/lib/session";

export interface GithubOAuthUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface GithubOAuthResult {
  user: GithubOAuthUser;
  sessionId: string;
}

class GithubOAuthService {
  getAuthorizeUrl(state: string): string {
    const url = new URL("https://github.com/login/oauth/authorize");

    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GITHUB_OAUTH_REDIRECT_URI);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);

    return url.toString();
  }

  private async exchangeCode(code: string): Promise<string> {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    );

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!data.access_token) {
      throw new AuthenticationError(
        `GitHub OAuth failed: ${data.error ?? "unknown error"}`,
      );
    }

    return data.access_token;
  }

  private async fetchUser(accessToken: string): Promise<GithubOAuthUser> {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const user = (await userResponse.json()) as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    };

    let email = user.email;

    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        primary: boolean;
      }>;

      email =
        emails.find((entry) => entry.primary)?.email ??
        emails[0]?.email ??
        null;
    }

    return {
      id: user.id,
      login: user.login,
      name: user.name ?? user.login,
      email,
      avatarUrl: user.avatar_url,
    };
  }

  async authenticate(code: string): Promise<GithubOAuthResult> {
    const accessToken = await this.exchangeCode(code);

    const oauthUser = await this.fetchUser(accessToken);

    const existing = await prisma.user.findUnique({
      where: { githubId: oauthUser.id },
    });

    let user = existing;

    if (!user) {
      user = await prisma.user.create({
        data: {
          githubId: oauthUser.id,
          login: oauthUser.login,
          name: oauthUser.name ?? oauthUser.login,
          email: oauthUser.email,
          avatarUrl: oauthUser.avatarUrl,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          login: oauthUser.login,
          name: oauthUser.name ?? oauthUser.login,
          email: oauthUser.email,
          avatarUrl: oauthUser.avatarUrl,
        },
      });
    }

    const sessionId = await sessionStore.create(user.id);

    return {
      user: oauthUser,
      sessionId,
    };
  }
}

export const githubOAuthService = new GithubOAuthService();
