import * as z from 'zod';
import {
  NormalizedEventDto,
  ProviderName,
} from 'src/domains/wealth-events/dto/normalized-event.dto';

export interface ProviderAdapter {
  name: ProviderName;
  schema: z.ZodSchema;
  normalize(payload: unknown): NormalizedEventDto;
}
