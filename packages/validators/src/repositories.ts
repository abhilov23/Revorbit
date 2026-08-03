import { z } from "zod";

export const connectRepositorySchema = z.object({
  installationId: z.string().min(1),
  githubId: z.number().int().positive(),
});

export type ConnectRepositoryInput = z.infer<typeof connectRepositorySchema>;
