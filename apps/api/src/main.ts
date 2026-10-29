import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
  mkdirSync(join(uploadDir, 'ads'), { recursive: true });
  mkdirSync(join(uploadDir, 'apk'), { recursive: true });
  mkdirSync(join(uploadDir, 'lost-property'), { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(uploadDir, { prefix: '/api/v1/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
