import { Body, Controller, Get, Post, Param, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { WarehouseControlService } from './warehouse-control.service';
@Controller('warehouse-control')
export class WarehouseControlController {
  constructor(private readonly service: WarehouseControlService) {}
  @Get() overview(@Req() req: { user: AuthUser }) {
    return this.service.overview(req.user);
  }
  @Post('locations') location(
    @Req() req: { user: AuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.location(req.user, body);
  }
  @Post('counts') count(
    @Req() req: { user: AuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.count(req.user, body);
  }
  @Post('counts/:id/review') review(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.review(req.user, id, body);
  }
}
