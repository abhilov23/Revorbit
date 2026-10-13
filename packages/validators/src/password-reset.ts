import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(200),
    password: z.string().min(8).max(100),
  })
  .refine((value) => value.password.length >= 8, {
    message: "Password must be at least 8 characters",
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
