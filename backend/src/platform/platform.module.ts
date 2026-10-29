import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { TenantService } from './tenant.service';
import {MarketService} from './market.service';
import {MarketController} from './market.controller';
import {NotificationScheduler} from './notification-scheduler';

@Module({
  controllers: [PlatformController,MarketController],
  providers: [PlatformService,MarketService,NotificationScheduler],
})
export class PlatformModule {}
