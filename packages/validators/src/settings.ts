import { z } from "zod";

export const roleSchema = z.enum([
  "REVIEWER",
  "SECURITY_RESEARCHER",
  "DEVELOPER",
  "HELPER",
]);

export const autonomySchema = z.enum([
  "OBSERVE",
  "SUGGEST",
  "PROPOSE",
  "AUTONOMOUS",
]);

export const updateRepositorySettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    security: z.boolean().optional(),
    correctness: z.boolean().optional(),
    performance: z.boolean().optional(),
    style: z.boolean().optional(),
    role: roleSchema.optional(),
    customPrompt: z.string().max(3000).nullish(),
    autonomyLevel: autonomySchema.optional(),
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
