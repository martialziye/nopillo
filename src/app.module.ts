import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { WealthEventsModule } from './domains/wealth-events/wealth-events.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.test', '.env.development'],
      cache: true,
      expandVariables: true,
      load: [appConfig],
    }),
    WealthEventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
