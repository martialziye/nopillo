import * as z from 'zod';
import { createConfig } from './_common/config.utils';

const namespace = 'app' as const;

const appConfigSchema = z.object({
  env: z.enum(['development', 'production', 'test']),
  corsOrigin: z.array(z.string()).optional(),
  port: z.number().int().positive(),
});

export type AppConfig = {
  [namespace]: z.infer<typeof appConfigSchema>;
};

export const appConfig = createConfig(namespace, appConfigSchema, {
  env: process.env.APP_ENV,
  corsOrigin: process.env.CORS_ORIGIN?.split(',') ?? [],
  port: Number(process.env.PORT),
});
