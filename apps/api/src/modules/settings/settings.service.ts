import { prisma } from "@revorbit/database";

import type { UpdateUserSettingsInput } from "@revorbit/validators";

export interface UserSettings {
  defaultModel: string;
  defaultMaxFiles: number;
  pullRequestReviews: boolean;
  inlineComments: boolean;
  mentionOnCritical: boolean;
  weeklyDigest: boolean;
  emailNotifications: boolean;
}

/**
 * Reads the caller's settings, creating the default row on first access so
 * clients never have to handle a missing record.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  const created = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  return created;
}

export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
): Promise<UserSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
}
