import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { ReturnablePackagingService } from './returnable-packaging.service';

@Controller('returnable-packaging')
export class ReturnablePackagingController {
  constructor(private readonly packaging: ReturnablePackagingService) {}

  @Get('custodians')
  custodians(@Req() req: { user: AuthUser }, @Query('projectId') projectId: string) { return this.packaging.custodians(req.user, projectId || ''); }

  @Get()
  list(@Req() req: { user: AuthUser }) { return this.packaging.list(req.user); }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() body: Record<string, unknown>) { return this.packaging.create(req.user, body); }

  @Post(':id/accept')
  accept(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.packaging.accept(req.user, id, body); }

  @Post(':id/events')
  reportEvent(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.packaging.reportEvent(req.user, id, body); }

  @Post('events/:eventId/confirm-return')
  confirmReturn(@Req() req: { user: AuthUser }, @Param('eventId') eventId: string, @Body() body: Record<string, unknown>) { return this.packaging.confirmReturn(req.user, eventId, body); }

  @Post('events/:eventId/review-incident')
  reviewIncident(@Req() req: { user: AuthUser }, @Param('eventId') eventId: string, @Body() body: Record<string, unknown>) { return this.packaging.reviewIncident(req.user, eventId, body); }
}
