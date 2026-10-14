import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { PlatformModule } from './platform/platform.module';
import { RecordsModule } from './records/records.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    ClientsModule,
    ProjectsModule,
    RecordsModule,
    PlatformModule,
  ],
})
export class AppModule {}
