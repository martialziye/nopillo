import { registerAs } from '@nestjs/config';
import * as z from 'zod';

export const validateConfig = <T extends z.ZodObject<z.ZodRawShape>>(
  namespace: string,
  schema: T,
  env: Record<keyof z.infer<T>, unknown>,
): z.infer<T> => {
  try {
    return schema.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const formatted = err.issues
        .map(
          (error: z.core.$ZodIssue) =>
            ` - ${error.path.join('.')}: ${error.message}`,
        )
        .join('\n');

      throw new Error(
        `Invalid configuration for "${namespace}":\n${formatted}`,
      );
    }
    throw err;
  }
};

export const createConfig = <T extends z.ZodObject<z.ZodRawShape>>(
  namespace: string,
  schema: T,
  env: Record<keyof z.infer<T>, unknown>,
) => {
  return registerAs(namespace, () => validateConfig(namespace, schema, env));
};
