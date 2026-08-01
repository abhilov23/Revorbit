import fs from "node:fs";
import path from "node:path";

import { createGithubApp } from "@mergeguard/github";

import { env } from "@/config/env";

export const github = createGithubApp({
  appId: env.GITHUB_APP_ID,
  privateKey: fs.readFileSync(
    path.resolve(process.cwd(), env.GITHUB_PRIVATE_KEY_PATH),
    "utf8",
  ),
});
