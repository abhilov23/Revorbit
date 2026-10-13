import { Hono } from "hono";
import type { AppContext, AppEnv } from "@/types/context";
import { requireUserId, validatedBody } from "@/types/context";

import { requireAuth } from "@/middleware/auth";
import { validate } from "@/validators/validate";
import { success } from "@/utils/response";
import { updateUserSettingsSchema } from "@revorbit/validators";
import type { UpdateUserSettingsInput } from "@revorbit/validators";

import { getUserSettings, updateUserSettings } from "./settings.service";

const settingsRouter = new Hono<AppEnv>();

settingsRouter.use("*", requireAuth);

settingsRouter.get("/", async (c: AppContext) => {
  const settings = await getUserSettings(requireUserId(c));
  return success(c, settings);
});

settingsRouter.put(
  "/",
  validate(updateUserSettingsSchema),
  async (c: AppContext) => {
    const input = validatedBody<UpdateUserSettingsInput>(c);
    const settings = await updateUserSettings(requireUserId(c), input);
    return success(c, settings);
  },
);

export default settingsRouter;
