import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { ShipmentWorkflowsService } from './shipment-workflows.service';

@Controller('shipment-workflows')
export class ShipmentWorkflowsController {
  constructor(private readonly workflows: ShipmentWorkflowsService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.workflows.list(req.user);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() body: Record<string, unknown>) {
    return this.workflows.create(req.user, body);
  }

  @Post(':id/dispatch')
  dispatch(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workflows.dispatch(req.user, id, body);
  }

  @Post(':id/receive')
  receive(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workflows.receive(req.user, id, body);
  }

  @Post(':id/cancel')
  cancel(@Req() req: { user: AuthUser }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workflows.cancel(req.user, id, body);
  }
}
