import { Hono } from "hono";

import { requireAuth } from "@/middleware/auth";
import { validate } from "@/validators/validate";
import { authController } from "./auth.controller";
import { githubOAuthController } from "./github-oauth.controller";
import { loginSchema, signupSchema } from "./auth.validators";

const authRouter = new Hono();

authRouter.post("/signup", validate(signupSchema), (c) =>
  authController.signup(c),
);

authRouter.post("/login", validate(loginSchema), (c) => authController.login(c));

authRouter.post("/logout", (c) => authController.logout(c));

authRouter.get("/github", (c) => githubOAuthController.authorize(c));

authRouter.get("/github/callback", (c) => githubOAuthController.callback(c));

authRouter.get("/me", requireAuth, (c) => authController.me(c));

export default authRouter;
