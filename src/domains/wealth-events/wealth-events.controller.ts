import { Controller, Logger, Post, Body, Param, Get } from '@nestjs/common';
import { WealthEventsService } from './wealth-events.service';
import { BankXAdapter } from 'src/providers/bankx/bankx.adapter';
import { CryptoAdapter } from 'src/providers/crypto/crypto.adapter';
import { InsurerAdapter } from 'src/providers/insurer/insurer.adapter';
import { ZodValidationPipe } from 'src/_common/pipes/zod-validation.pipe';

@Controller('wealth-events')
export class WealthEventsController {
  private readonly logger = new Logger(WealthEventsController.name);

  constructor(private readonly wealthEventsService: WealthEventsService) {}

  @Post('/webhooks/bankx')
  ingestBankX(@Body(new ZodValidationPipe(BankXAdapter.schema)) body: unknown) {
    const event = BankXAdapter.normalize(body);
    return this.wealthEventsService.ingest(event);
  }

  @Post('/webhooks/crypto')
  ingestCrypto(
    @Body(new ZodValidationPipe(CryptoAdapter.schema)) body: unknown,
  ) {
    const event = CryptoAdapter.normalize(body);
    return this.wealthEventsService.ingest(event);
  }

  @Post('/webhooks/insurer')
  ingestInsurer(
    @Body(new ZodValidationPipe(InsurerAdapter.schema)) body: unknown,
  ) {
    const event = InsurerAdapter.normalize(body);
    return this.wealthEventsService.ingest(event);
  }

  @Get('/wealth/:userId/balance')
  getBalance(@Param('userId') userId: string) {
    return this.wealthEventsService.getGlobalBalance(userId);
  }

  @Get('/wealth/:userId/accounts')
  getAccounts(@Param('userId') userId: string) {
    return this.wealthEventsService.getAccounts(userId);
  }

  @Get('/wealth/:userId/timeline')
  getTimeline(@Param('userId') userId: string) {
    return this.wealthEventsService.getTimeline(userId);
  }
}
