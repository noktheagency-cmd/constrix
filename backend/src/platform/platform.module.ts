import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { TenantService } from './tenant.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, TenantService],
})
export class PlatformModule {}
