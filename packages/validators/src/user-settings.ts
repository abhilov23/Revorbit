import { z } from "zod";

import { autonomySchema } from "./settings.js";

export const updateUserSettingsSchema = z
  .object({
    defaultModel: z.string().min(1).max(100).optional(),
    defaultMaxFiles: z.number().int().min(1).max(100).optional(),
    pullRequestReviews: z.boolean().optional(),
    inlineComments: z.boolean().optional(),
    mentionOnCritical: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    defaultAutonomy: autonomySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting must be provided",
  });

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
