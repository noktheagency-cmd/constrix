import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { MaterialHandoverService } from './material-handover.service';

@Controller('material-handovers')
export class MaterialHandoverController {
  constructor(private readonly handovers: MaterialHandoverService) {}

  @Get('custodians')
  custodians(@Req() req: { user: AuthUser }, @Query('projectId') projectId: string) {
    return this.handovers.custodians(req.user, projectId || '');
  }

  @Get('holds')
  holds(@Req() req: { user: AuthUser }) {
    return this.handovers.holds(req.user);
  }

  @Get('review-queue')
  reviewQueue(@Req() req: { user: AuthUser }) {
    return this.handovers.reviewQueue(req.user);
  }

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.handovers.list(req.user);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() body: Record<string, unknown>) {
    return this.handovers.create(req.user, body);
  }

  @Post(':id/accept')
  accept(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.handovers.accept(req.user, id, body);
  }

  @Post(':id/actions')
  requestAction(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.handovers.requestAction(req.user, id, body);
  }

  @Post('actions/:actionId/review')
  reviewAction(@Req() req: { user: AuthUser }, @Param('actionId') actionId: string, @Body() body: Record<string, unknown>) {
    return this.handovers.reviewAction(req.user, actionId, body);
  }

  @Post(':id/cancel')
  cancel(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.handovers.cancel(req.user, id, body);
  }
}
