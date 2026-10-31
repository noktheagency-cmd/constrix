import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthService } from './auth/auth.service';
import { AppModule } from './app.module';
import {json,raw} from 'express';

const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function allowedOrigins() {
  const configured = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return ['http://localhost:5173', ...configured];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/api/blob-files',raw({type:'application/octet-stream',limit:'20mb'}));
  app.use(json({limit:'3mb'}));
  await app.get(AuthService).seed();
  app.setGlobalPrefix('api');
  app.enableCors({ origin: allowedOrigins(), credentials: true, exposedHeaders: ['X-Request-ID'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  if(process.env.HOST)await app.listen(process.env.PORT ?? 3001,process.env.HOST);
  else await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
