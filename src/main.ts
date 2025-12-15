import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { type AppConfig } from './app.config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<AppConfig>);
  const corsOrigin = configService.get('app.corsOrigin', { infer: true });

  if (corsOrigin && corsOrigin.length > 0) {
    app.enableCors({
      origin: corsOrigin.map((origin) => new RegExp(origin)),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      maxAge: 3600,
    });
  }
  const port = configService.getOrThrow('app.port', { infer: true });
  await app.listen(port || 3000);
}

void bootstrap();
