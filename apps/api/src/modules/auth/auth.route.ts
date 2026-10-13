import { Hono } from "hono";
import type { AppEnv } from "@/types/context";

import { requireAuth } from "@/middleware/auth";
import { authRateLimit } from "@/middleware/rate-limit";
import { validate } from "@/validators/validate";
import { authController } from "./auth.controller";
import { githubOAuthController } from "./github-oauth.controller";
import { loginSchema, signupSchema } from "./auth.validators";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@revorbit/validators";

const authRouter = new Hono<AppEnv>();

// Credential endpoints are rate limited far more tightly than the rest of the
// API: signup performs a bcrypt hash and login is a password oracle.
authRouter.use("/signup", authRateLimit);
authRouter.use("/login", authRateLimit);
authRouter.use("/forgot-password", authRateLimit);
authRouter.use("/reset-password", authRateLimit);

authRouter.post("/signup", validate(signupSchema), (c) =>
  authController.signup(c),
);

authRouter.post("/login", validate(loginSchema), (c) =>
  authController.login(c),
);

authRouter.post("/logout", (c) => authController.logout(c));

authRouter.get("/github", (c) => githubOAuthController.authorize(c));

authRouter.get("/github/callback", (c) => githubOAuthController.callback(c));

authRouter.post("/forgot-password", validate(forgotPasswordSchema), (c) =>
  authController.forgotPassword(c),
);

authRouter.post("/reset-password", validate(resetPasswordSchema), (c) =>
  authController.resetPassword(c),
);

authRouter.get("/me", requireAuth, (c) => authController.me(c));

export default authRouter;
