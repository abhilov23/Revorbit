import dotenv from 'dotenv';
import {z} from 'zod';

dotenv.config();


const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('localhost'),
    PORT: z.coerce.number().default(3000),
    API_PREFIX: z.string().default('/api'),
    LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
    CORS_ORIGIN: z.string(),
})

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('Invalid environment variables:', parsedEnv.error.format());
    process.exit(1);
}

export const env = parsedEnv.data;



