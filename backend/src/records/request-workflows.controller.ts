import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { RequestWorkflowsService } from './request-workflows.service';

@Controller('request-workflows')
export class RequestWorkflowsController {
  constructor(private readonly workflows: RequestWorkflowsService) {}

  @Get('board')
  board(@Req() req: { user: AuthUser }) {
    return this.workflows.board(req.user);
  }

  @Get('reservations')
  reservations(@Req() req: { user: AuthUser }) {
    return this.workflows.listReservations(req.user);
  }

  @Post('decision')
  decide(
    @Req() req: { user: AuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.workflows.decide(req.user, body);
  }
}
