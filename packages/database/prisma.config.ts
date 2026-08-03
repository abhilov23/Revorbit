import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

import { getRepoRootEnvPath } from "@revorbit/shared";

dotenv.config({
  path: getRepoRootEnvPath(),
});

export default defineConfig({
  schema: "prisma/schema.prisma",
});
