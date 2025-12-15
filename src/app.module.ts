import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { WealthEventsModule } from './domains/wealth-events/wealth-events.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      cache: true,
      expandVariables: true,
      load: [appConfig],
    }),
    WealthEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
