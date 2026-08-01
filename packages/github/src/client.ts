import {createAppAuth} from "@octokit/auth-app";
import {Octokit} from "@octokit/rest";

export interface GithubAppConfig {
    appId: number;
    privateKey: string;
}

export interface GithubClient{
    app: Octokit;
    
    getInstallationClient(installationId: number): Promise<Octokit>;
}

export function createGithubApp(config: GithubAppConfig):GithubClient {
 const app = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  });

  async function getInstallationClient(
    installationId: number
  ): Promise<Octokit> {
    const {
      data: { token },
    } = await app.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    return new Octokit({
      auth: token,
    });
  }

  return {
    app,
    getInstallationClient,
  };
}