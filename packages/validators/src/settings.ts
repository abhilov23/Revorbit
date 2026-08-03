import { z } from "zod";

export const updateRepositorySettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    security: z.boolean().optional(),
    performance: z.boolean().optional(),
    bestPractices: z.boolean().optional(),
    model: z.string().min(1).max(100).optional(),
    maxFiles: z.number().int().min(1).max(100).optional(),
    maxTokens: z.number().int().min(100).max(128000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting must be provided",
  });

export type UpdateRepositorySettingsInput = z.infer<
  typeof updateRepositorySettingsSchema
>;
