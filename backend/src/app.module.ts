import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RequestContextMiddleware, RequestExceptionFilter } from './request-context';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { PlatformModule } from './platform/platform.module';
import { RecordsModule } from './records/records.module';
import {BlobFilesModule} from './records/blob-files.module';

@Module({
  providers: [{ provide: APP_FILTER, useClass: RequestExceptionFilter }],
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    ClientsModule,
    ProjectsModule,
    RecordsModule,
    BlobFilesModule,
    PlatformModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(RequestContextMiddleware).forRoutes('*'); }
}
