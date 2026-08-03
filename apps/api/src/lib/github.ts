import fs from "node:fs";
import path from "node:path";

import { createGithubApp } from "@revorbit/github";

import { env } from "@/config/env";

export const github = createGithubApp({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY ?? getPrivateKeyFromFile(),
});

function getPrivateKeyFromFile(): string {
  if (!env.GITHUB_PRIVATE_KEY_PATH) {
    throw new Error(
      "Either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH must be set",
    );
  }

  return fs.readFileSync(
    path.resolve(process.cwd(), env.GITHUB_PRIVATE_KEY_PATH),
    "utf8",
  );
}
