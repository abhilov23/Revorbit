import { Hono } from "hono";

import { requireAuth } from "@/middleware/auth";
import { validate } from "@/validators/validate";
import {
  connectRepositorySchema,
  updateRepositorySettingsSchema,
} from "@revorbit/validators";
import { repositoryController } from "./repository.controller";

const repositoryRouter = new Hono();

repositoryRouter.use("*", requireAuth);

repositoryRouter.get("/", (c) => repositoryController.list(c));

repositoryRouter.post(
  "/connect",
  validate(connectRepositorySchema),
  (c) => repositoryController.connect(c),
);

repositoryRouter.get("/:repositoryId", (c) => repositoryController.get(c));

repositoryRouter.put(
  "/:repositoryId/settings",
  validate(updateRepositorySettingsSchema),
  (c) => repositoryController.updateSettings(c),
);

repositoryRouter.delete("/:repositoryId", (c) =>
  repositoryController.disconnect(c),
);

export default repositoryRouter;
