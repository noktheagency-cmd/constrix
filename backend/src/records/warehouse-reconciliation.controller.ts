import { Controller, Get, Req } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { WarehouseReconciliationService } from './warehouse-reconciliation.service';

@Controller('warehouse-reconciliation')
export class WarehouseReconciliationController {
  constructor(private readonly reconciliation: WarehouseReconciliationService) {}

  @Get()
  report(@Req() request: { user: AuthUser }) {
    return this.reconciliation.report(request.user);
  }
}
