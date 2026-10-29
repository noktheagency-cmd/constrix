import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantService } from '../platform/tenant.service';
import { TenantDataService } from './tenant-data.service';

@Global()
@Module({
  providers: [PrismaService,TenantService,TenantDataService],
  exports: [PrismaService,TenantService,TenantDataService],
})
export class PrismaModule {}
