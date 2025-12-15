import { Module } from '@nestjs/common';
import { WealthEventsService } from './wealth-events.service';
import { WealthEventsController } from './wealth-events.controller';

@Module({
  imports: [],
  controllers: [WealthEventsController],
  providers: [WealthEventsService],
  exports: [WealthEventsService],
})
export class WealthEventsModule {}
