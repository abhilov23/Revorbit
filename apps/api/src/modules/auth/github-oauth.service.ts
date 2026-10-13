import { prisma } from "@revorbit/database";

import { env } from "@/config/env";
import { AuthenticationError } from "@/errors";
import { sessionStore } from "@/lib/session";
import { logger } from "@/lib/logger";

export interface GithubOAuthUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  /** True when GitHub has verified ownership of the email address. */
  emailVerified: boolean;
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
    let emailVerified = false;

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
        verified: boolean;
      }>;

      const chosen = emails.find((entry) => entry.primary) ?? emails[0] ?? null;

      email = chosen?.email ?? null;
      emailVerified = chosen?.verified ?? false;
    } else {
      // `/user` returning an address means GitHub already treats it as the
      // account's own.
      emailVerified = true;
    }

    return {
      id: user.id,
      login: user.login,
      name: user.name ?? user.login,
      email,
      emailVerified,
      avatarUrl: user.avatar_url,
    };
  }

  async authenticate(code: string): Promise<GithubOAuthResult> {
    const accessToken = await this.exchangeCode(code);

    const oauthUser = await this.fetchUser(accessToken);

    let user = await prisma.user.findUnique({
      where: { githubId: oauthUser.id },
    });

    if (!user && oauthUser.email && oauthUser.emailVerified) {
      /*
       * Account linking. Without this, a user who registered with email and
       * then signs in with GitHub ends up with a second, empty account and
       * loses their repositories and settings. Safe because GitHub has verified
       * the address and the candidate has no GitHub identity of its own, so an
       * existing link is never reassigned to someone else.
       */
      const byEmail = await prisma.user.findUnique({
        where: { email: oauthUser.email },
      });

      if (byEmail && !byEmail.githubId) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            githubId: oauthUser.id,
            login: oauthUser.login,
            ...(byEmail.name
              ? {}
              : { name: oauthUser.name ?? oauthUser.login }),
            avatarUrl: oauthUser.avatarUrl ?? byEmail.avatarUrl,
          },
        });

        logger.info(
          { userId: user.id, githubId: oauthUser.id },
          "auth.account.linked_by_email",
        );
      }
    }

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

    // An installation performed while this person signed in by email has no
    // Revorbit owner, because the webhook could not match a user that had no
    // githubId yet. Now that the id is known, claim those installations.
    await this.claimInstallations(user.id, oauthUser.id, oauthUser.login);

    return {
      user: oauthUser,
      sessionId,
    };
  }

  /**
   * Links unowned installations to the user who installed them.
   *
   * Two safe routes: GitHub reports `installedByGithubId`, which identifies
   * the installer exactly; and a user-account installation whose login matches
   * the signed-in login, since a personal installation belongs to one GitHub
   * user. Organisation installations never match by login, so an installation
   * owned by someone else cannot be claimed.
   */
  private async claimInstallations(
    userId: string,
    githubId: number,
    login: string,
  ): Promise<number> {
    const byInstaller = await prisma.installation.updateMany({
      where: { installedByGithubId: githubId, userId: null },
      data: { userId },
    });

    const byLogin = await prisma.installation.updateMany({
      where: { accountLogin: login, accountType: "User", userId: null },
      data: { userId },
    });

    const claimed = byInstaller.count + byLogin.count;

    if (claimed > 0) {
      logger.info(
        { userId, githubId, login, claimed },
        "auth.installations.claimed",
      );
    }

    return claimed;
  }
}

export const githubOAuthService = new GithubOAuthService();
