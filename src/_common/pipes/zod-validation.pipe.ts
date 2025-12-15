import { PipeTransform } from '@nestjs/common';
import * as z from 'zod';

import { BadRequestException } from '@nestjs/common';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        issues,
      });
    }

    return result.data;
  }
}
